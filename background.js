
var storage = {
    _storage: {},
    save: function(data) {
        var oldData = this.get(data.tabId);
        if (oldData && !data.imgData) {
            data.imgData = oldData.imgData;
        }
        this._storage[data.tabId] = data;
    },
    get: function(id) {
        return this._storage[id];
    }
};

var sendData = function(tab, opts) {
    var tabData = storage.get(tab.id) || {tabId: tab.id};

    if (opts && opts.toggle) {
        tabData.visible = !tabData.visible;
    } else if (!tabData.visible) {
        return;
    }

    storage.save(tabData);
    chrome.tabs.sendRequest(tab.id, {
        action: 'toggle',
        pageData: tabData
    });
};


var communication = {
    extensionIconClick: function(tab) {
        sendData(tab, {toggle: true});
    },
    injectedScriptRequest: function(request) {
        communication.actions[request.action](request);
    },
    actions: {
        save: function(request) {
            storage.save(request.pageData);
        },
        request: function() {
            chrome.tabs.getSelected(sendData);
        }
    }
};

// on extensions icon click
chrome.browserAction.onClicked.addListener(communication.extensionIconClick);

// when the inject script sends a request
chrome.extension.onRequest.addListener(communication.injectedScriptRequest);
