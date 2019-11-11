## Microservices inside Salesforce With Platform Events and Change Data Capture

Thank you for coming to my talk, I hope that it was informative. This repository contains the off-platform service code, written in NodeJS used in the demonstration. It is intended to be used with Heroku, but can also be run locally.

Please note, this service is **not production ready**, it is intented to be used only as an example.

### Heroku Invoicing Service

#### Introduction

This is a simple service to generate PDF invoices based on platform events recieved, it will then fire a platform event in response containing the invoice PDF as a base64 string along with the ID of the record it originated from and the invoice number.

It is intented to be used with the apex code [located here](https://github.com/mickwheelz/DF2019-Invoicing-Salesforce "Apex Repository").

#### Usage
The service can be run locally by executing `node index.js`, or can be deployed to heroku and will run automatically.

The following enviornment variables must be set to run the application

`SF_USERNAME` username for salesforce (e.g `email@domain.com`)

`SF_PASSTOKEN` the password and token for salesforce (e.g `passwordToken`)

`SF_INV_REQ` the platform event to use for invoice requests (e.g `Generate_Invoice_PDF__e`)

`SF_INV_RES` the platform event to use for invoice responses (e.g `Invoice_PDF__e`)
