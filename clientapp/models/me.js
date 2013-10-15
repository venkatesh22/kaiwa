/*global app, client*/
"use strict";

var HumanModel = require('human-model');
var Contacts = require('./contacts');
var Calls = require('./calls');
var Contact = require('./contact');
var MUCs = require('./mucs');
var MUC = require('./muc');
var fetchAvatar = require('../helpers/fetchAvatar');


module.exports = HumanModel.define({
    initialize: function (opts) {
        if (opts.avatarID) {
            this.setAvatar(opts.avatarID);
        }

        this.bind('change:jid', this.load, this);
        this.bind('change:hasFocus', function () {
            this.setActiveContact(this._activeContact);
        }, this);
        this.bind('change:avatarID', this.save, this);
        this.bind('change:status', this.save, this);
        this.bind('change:rosterVer', this.save, this);

        this.contacts.bind('change:unreadCount', this.updateUnreadCount, this);
        app.state.bind('change:active', this.updateIdlePresence, this);
    },
    props: {
        jid: ['object', true],
        status: ['string', true, ''],
        avatarID: ['string', true, ''],
        rosterVer: ['string', true, '']
    },
    session: {
        avatar: ['string', true, ''],
        connected: ['bool', true, false],
        shouldAskForAlertsPermission: ['bool', true, false],
        hasFocus: ['bool', true, false],
        _activeContact: ['string', true, ''],
        displayName: ['string', true, 'Me']
    },
    collections: {
        contacts: Contacts,
        mucs: MUCs,
        calls: Calls
    },
    setActiveContact: function (jid) {
        var prev = this.getContact(this._activeContact);
        if (prev) {
            prev.activeContact = false;
        }
        var curr = this.getContact(jid);
        if (curr) {
            curr.activeContact = true;
            curr.unreadCount = 0;
        }
        this._activeContact = jid;
    },
    setAvatar: function (id, type) {
        var self = this;
        fetchAvatar('', id, type, function (avatar) {
            self.avatarID = avatar.id;
            self.avatar = avatar.uri;
        });
    },
    getContact: function (jid, alt) {
        if (typeof jid === 'string') jid = new client.JID(jid);
        if (typeof alt === 'string') alt = new client.JID(alt);

        if (this.isMe(jid)) {
            jid = alt || jid;
        }
        return this.contacts.get(jid.bare) || this.mucs.get(jid.bare) || undefined;
    },
    setContact: function (data, create) {
        var contact = this.getContact(data.jid);
        data.jid = data.jid.bare;

        if (contact) {
            contact.set(data);
            contact.save();
        } else if (create) {
            contact = new Contact(data);
            contact.inRoster = true;
            contact.owner = this.jid.bare;
            contact.save();
            this.contacts.add(contact);
        }
    },
    removeContact: function (jid) {
        this.contacts.remove(jid.bare);
        app.storage.roster.remove(jid.bare);
    },
    load: function () {
        if (!this.jid.bare) return;

        var self = this;

        app.storage.profiles.get(this.jid.bare, function (err, profile) {
            if (!err) {
                self.status = profile.status;
                self.avatarID = profile.avatarID;
            }
            self.save();
            app.storage.roster.getAll(self.jid.bare, function (err, contacts) {
                if (err) return;

                contacts.forEach(function (contact) {
                    contact = new Contact(contact);
                    contact.owner = self.jid.bare;
                    contact.inRoster = true;
                    contact.save();
                    self.contacts.add(contact);
                });

                self.contacts.trigger('loaded');
            });
        });
    },
    isMe: function (jid) {
        return jid.bare === this.jid.bare;
    },
    updateIdlePresence: function () {
        var update = {
            status: this.status,
            show: this.show,
            caps: app.api.disco.caps
        };

        if (!app.state.active) {
            update.idle = {since: app.state.idleSince};
        }

        app.api.sendPresence(update);
    },
    updateUnreadCount: function () {
        var unreadCounts = this.contacts.pluck('unreadCount');
        var count = unreadCounts.reduce(function (a, b) { return a + b; });
        if (count === 0) {
            count = '';
        }
        app.state.badge = '' + count;
    },
    save: function () {
        var data = {
            jid: this.jid.bare,
            avatarID: this.avatarID,
            status: this.status,
            rosterVer: this.rosterVer
        };
        app.storage.profiles.set(data);
    }
});
