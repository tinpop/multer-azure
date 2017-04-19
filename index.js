/**
 * This module is a Multer Engine for Azure Blog Storage
 */
"use strict";
exports.__esModule = true;
var azure = require("azure-storage");
var Blob = (function () {
    //Creates a new service to interact with azure blob storage
    function Blob(opts) {
        this.container = opts.container;
        this.blobSvc = opts.connectionString ? azure.createBlobService(opts.connectionString) : azure.createBlobService(opts.account, opts.key);
        this.createContainer(this.container);
        this.blobPathResolver = opts.blobPathResolver;
    }
    ;
    //This creates the container if one doesn't exist
    Blob.prototype.createContainer = function (name) {
        this.blobSvc.createContainerIfNotExists(name, function (error, result, response) {
            if (error) {
                throw error;
            }
        });
    };
    // actual upload function, will wait for blobPathResolver callback before upload.
    Blob.prototype.uploadToBlob = function (req, file, cb) {
        var that = this;
        var options = {
            contentSettings: {
                contentType: file.mimetype
            }
        };
        return function (something, blobPath) {
            var blobStream = that.blobSvc.createWriteStreamToBlockBlob(that.container, blobPath, options, function (error) {
                if (error) {
                    cb(error);
                }
            });
            file.stream.pipe(blobStream);
            blobStream.on("close", function () {
                var fullUrl = that.blobSvc.getUrl(that.container, blobPath);
                var fileClone = JSON.parse(JSON.stringify(file));
                fileClone.container = that.container;
                fileClone.blobPath = blobPath;
                fileClone.url = fullUrl;
                cb(null, fileClone);
            });
            blobStream.on("error", function (error) {
                cb(error);
            });
        };
    };
    //Handles the files delivered from Multer and sends them to Azure Blob storage. _handleFile is a required function for multer storage engines
    Blob.prototype._handleFile = function (req, file, cb) {
        if (this.blobPathResolver) {
            // call blobPathResolver to resolve the blobPath
            this.blobPathResolver(req, file, this.uploadToBlob(req, file, cb));
        }
        else {
            //Extracts the extension for the filename
            var re = /(?:\.([^.]+))?$/;
            var ext = re.exec(file.originalname)[1];
            //Creates a unique filename based on the time and appends the extension
            var newName = Date.now() + '-' + encodeURIComponent(new Buffer(file.originalname).toString('base64')) + '.' + ext;
            this.uploadToBlob(req, file, cb)(null, newName);
        }
    };
    //Removes files for Multer when it chooses to. _removeFile is a required function for multer storage engines
    Blob.prototype._removeFile = function (req, file, cb) {
        this.blobSvc.deleteBlob(this.container, file.filename, cb);
    };
    return Blob;
}());
module.exports = function (opts) {
    return new Blob(opts);
};
