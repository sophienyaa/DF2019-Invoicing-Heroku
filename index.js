//Libraries
const jsforce = require('jsforce');
const PDFDocument = require("pdfkit");
const express = require('express');
const { Base64Encode } = require('base64-stream');
const { generateInvoice } = require("./generateInvoice.js");

//Env Vars
const username = process.env.SF_USERNAME;
const password = process.env.SF_PASSTOKEN;
const invoiceReqTopic = process.env.SF_INV_REQ;
const invoiceResTopic = process.env.SF_INV_RES;
const port = process.env.PORT || 3000;

//Connection & Express app
var conn = new jsforce.Connection({});
const app = express();

//Setup app, login to salesforce and begin listening for events
function begin() {
  app.get('/', (req, res) => res.send('Invoice Service Running!'))
  app.listen(port, () => console.log(`Invoice Service running on port ${port}!`))

  conn.login(username, password, function(err, userInfo) {
    if (err) { return console.error(err); }
    console.log(userInfo);
    conn.streaming.topic("/event/" + invoiceReqTopic).subscribe(function(message) {
      processGenerateInvoicePDFEvent(message.payload);
    });
  });
}

//Fire the invoice return event defined in SF_INV_RES env var
function fireInvoicePDFEvent(invoiceBase64, recordId, invoiceNumber) {

  var invoicePDFEvent = {
      Invoice_PDF_Base64__c: invoiceBase64, 
      Related_Object_Id__c : recordId, 
      Invoice_Number__c: invoiceNumber
  };

  conn.sobject(invoiceResTopic).create(invoicePDFEvent, function(err, ret) {
      if (err || !ret.success) { return console.error(err, ret); }
      console.log("Created record id : " + ret.id);
  });

}

//Process the incoming event defined in SF_INV_REQ env var to generate an invoice PDF
function processGenerateInvoicePDFEvent(invoice) {

  let doc = new PDFDocument({ size: "A4", margin: 50 });
  var finalString = '';
  invoice.subtotal = 0;
  invoice.paid = 0;

  invoice.items = JSON.parse(invoice.Invoice_Line_Item_JSON__c);

  invoice.items.forEach(i => {
    invoice.subtotal += i.itemCost * i.quantity;
  })

  generateInvoice(doc, invoice);

  var stream = doc.pipe(new Base64Encode());  
  doc.end();
  
  stream.on('data', function(chunk) {
      finalString += chunk;
  });
  
  stream.on('end', function() {
    fireInvoicePDFEvent(finalString, invoice.Source_Record_Id__c, invoice.Invoice_Number__c); 
  });

}

begin();