/*global indexedDB*/
"use strict";

var AvatarStorage = require('./avatars');
var RosterStorage = require('./roster');
var DiscoStorage = require('./disco');
var ArchiveStorage = require('./archive');
var ProfileStorage = require('./profile');


function Storage() {
    this.db = null;
    this.init = [];

    this.avatars = new AvatarStorage(this);
    this.roster = new RosterStorage(this);
    this.disco = new DiscoStorage(this);
    this.archive = new ArchiveStorage(this);
    this.profiles = new ProfileStorage(this);
}
Storage.prototype = {
    constructor: {
        value: Storage
    },
    version: 3,
    open: function (cb) {
        cb = cb || function () {};

        var self = this;
        var request = indexedDB.open('datastorage', this.version);
        request.onsuccess = function (e) {
            self.db = e.target.result;
            cb(false, self.db);
        };
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            self.avatars.setup(db);
            self.roster.setup(db);
            self.disco.setup(db);
            self.archive.setup(db);
            self.profiles.setup(db);
        };
        request.onerror = cb;
    }
};


module.exports = Storage;
