const jsforce = require('jsforce');
const PDFDocument = require("pdfkit");
const { Base64Encode } = require('base64-stream');
const express = require('express');

const username = process.env.SF_USERNAME;
const password = process.env.SF_PASSTOKEN;
const invoiceReqTopic = process.env.SF_INV_REQ;
const invoiceResTopic = process.env.SF_INV_RES;
const port = process.env.PORT || 3000;

var conn = new jsforce.Connection({});
const app = express();

app.get('/', (req, res) => res.send('Invoice Service Running!'))
app.listen(port, () => console.log(`Invoice Service running on port ${port}!`))

conn.login(username, password, function(err, userInfo) {
  if (err) { return console.error(err); }
  console.log(userInfo);
  conn.streaming.topic("/event/" + invoiceReqTopic).subscribe(function(message) {
      processMessage(message);
  });
});

function processMessage(message) {
    console.dir(message.payload);

    const customerInfo = JSON.parse(message.payload.Customer_Information__c);
    const invoiceItems = JSON.parse(message.payload.Line_Item_Information__c);
    const invoice = {
        customerInfo: customerInfo,
        items: invoiceItems
    }
    
    createInvoice(invoice);
}

function createInvoice(invoice) {
  let doc = new PDFDocument({ size: "A4", margin: 50 });
  var finalString = '';
  invoice.subtotal = 0;
  invoice.paid = 0;


  invoice.items.forEach(i => {
    invoice.subtotal += i.itemCost * i.quantity;
  })

  generateHeader(doc);
  generateCustomerInformation(doc, invoice);
  generateInvoiceTable(doc, invoice);
  generateFooter(doc);

  var stream = doc.pipe(new Base64Encode());  
  doc.end();
  
  stream.on('data', function(chunk) {
      finalString += chunk;
  });
  
  stream.on('end', function() {
    sendResponse(finalString, invoice.customerInfo.oppId, invoice.customerInfo.invoiceNumber); 
  });

}

function sendResponse(finalString, oppId, invoiceNumber) {

    var response = {
        Invoice_PDF_Base64__c: finalString, 
        Related_OppId__c : oppId, 
        Invoice_Number__c: invoiceNumber
    };

    conn.sobject(invoiceResTopic).create(response, function(err, ret) {
        if (err || !ret.success) { return console.error(err, ret); }
        console.log("Created record id : " + ret.id);
    });

}

function generateHeader(doc) {
  doc
    .image("logo.png", 50, 45, { width: 50 })
    .fillColor("#444444")
    .fontSize(20)
    .text("OVO Energy", 110, 57)
    .fontSize(10)
    .text("OVO Energy", 200, 50, { align: "right" })
    .text("1 Rivergate", 200, 65, { align: "right" })
    .text("Bristol  BS16ED", 200, 80, { align: "right" })
    .text("United Kingdom", 200, 95, { align: "right" })
    .moveDown();
}

function generateCustomerInformation(doc, invoice) {
  doc
    .fillColor("#444444")
    .fontSize(20)
    .text("Invoice", 50, 160);

  generateHr(doc, 185);

  const customerInformationTop = 200;

  doc
    .fontSize(10)
    .text("Invoice Number:", 50, customerInformationTop)
    .font("Helvetica-Bold")
    .text(invoice.customerInfo.invoiceNumber, 150, customerInformationTop)
    .font("Helvetica")
    .text("Invoice Date:", 50, customerInformationTop + 15)
    .text(formatDate(new Date()), 150, customerInformationTop + 15)
    .text("Balance Due:", 50, customerInformationTop + 30)
    .text(
      formatCurrency(invoice.subtotal - invoice.paid),
      150,
      customerInformationTop + 30
    )

    .font("Helvetica-Bold")
    .text(invoice.customerInfo.companyName, 300, customerInformationTop)
    .font("Helvetica-Bold")
    .text(invoice.customerInfo.customerName, 300, customerInformationTop + 15)
    .font("Helvetica")
    .text(invoice.customerInfo.addressStreet, 300, customerInformationTop + 30)
    .text(
      invoice.customerInfo.city +
        ", " +
        invoice.customerInfo.postcode +
        ", " +
        invoice.customerInfo.country,
      300,
      customerInformationTop + 45
    )
    .moveDown();

  generateHr(doc, 267);
}

function generateInvoiceTable(doc, invoice) {
  let i;
  const invoiceTableTop = 330;

  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    invoiceTableTop,
    "Item",
    "Description",
    "Unit Cost",
    "Quantity",
    "Line Total"
  );
  generateHr(doc, invoiceTableTop + 20);
  doc.font("Helvetica");

  for (i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i];
    const position = invoiceTableTop + (i + 1) * 30;
    generateTableRow(
      doc,
      position,
      item.productCode,
      item.lineDescription,
      formatCurrency(item.itemCost / item.quantity),
      item.quantity,
      formatCurrency(item.itemCost)
    );

    generateHr(doc, position + 20);
  }

  const subtotalPosition = invoiceTableTop + (i + 1) * 30;
  generateTableRow(
    doc,
    subtotalPosition,
    "",
    "",
    "Subtotal",
    "",
    formatCurrency(invoice.subtotal)
  );

  const paidToDatePosition = subtotalPosition + 20;
  generateTableRow(
    doc,
    paidToDatePosition,
    "",
    "",
    "Paid To Date",
    "",
    formatCurrency(invoice.paid)
  );

  const duePosition = paidToDatePosition + 25;
  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    duePosition,
    "",
    "",
    "Balance Due",
    "",
    formatCurrency(invoice.subtotal - invoice.paid)
  );
  doc.font("Helvetica");
}

function generateFooter(doc) {
  doc
    .fontSize(10)
    .text(
      "Payment is due within 30 days. Thank you for your business.",
      50,
      780,
      { align: "center", width: 500 }
    );
}

function generateTableRow(
  doc,
  y,
  item,
  description,
  unitCost,
  quantity,
  lineTotal
) {
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(description, 150, y)
    .text(unitCost, 280, y, { width: 90, align: "right" })
    .text(quantity, 370, y, { width: 90, align: "right" })
    .text(lineTotal, 0, y, { align: "right" });
}

function generateHr(doc, y) {
  doc
    .strokeColor("#aaaaaa")
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}

function formatCurrency(amount) {
  return "£" + amount;
}

function formatDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return year + "/" + month + "/" + day;
}