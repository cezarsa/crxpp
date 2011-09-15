window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder;

var Crxpp = (function() {

    var errorHandler = function(e) {
        console.log(e);
    };

    var ctor = function() {
        this.visible = false;
        this.pageData = null;
        this.overlayImageId = 'crxpp_overlay_img';
        this._bindEvents();
        this._checkEnabled();
    };

    ctor.prototype = {
        _bindEvents: function() {
            var self = this;
            chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
                if (request.action == 'toggle') {
                    self.pageData = request.pageData;
                    self.toggle();
                }
            });
        },

        _checkEnabled: function() {
            chrome.extension.sendRequest({
                action: 'request',
                url: window.location.href
            });
        },

        toggle: function() {
            if (!this.element) {
                this._initDOM();
            }
            if (this.visible) {
                this.visible = false;
                this.element.style.display = 'none';
            } else {
                this.visible = true;
                this.element.style.display = '';
            }
        },

        renderImage: function(formData) {
            var imgId = this.overlayImageId;
            var overlayImg = document.getElementById(imgId);

            if (overlayImg) {
                if (formData.enabled) {
                    overlayImg.style.display = '';
                } else {
                    overlayImg.style.display = 'none';
                }
            }

            if (!overlayImg) {
                overlayImg = document.createElement('img');
                overlayImg.id = imgId;
                overlayImg.style.position = 'absolute';
                document.body.appendChild(overlayImg);
            }

            overlayImg.style.zIndex = formData.z;
            overlayImg.style.left = formData.x + 'px';
            overlayImg.style.top = formData.y + 'px';
            overlayImg.style.opacity = formData.opacity;

            if (!formData.imgData) {
                return;
            }
            window.requestFileSystem(window.TEMPORARY, 5 * 1024 * 1024, function(fs) {
                fs.root.getFile(imgId, {
                    create: true
                }, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {
                        fileWriter.onwriteend = function(e) {
                            overlayImg.src = fileEntry.toURL();
                        };
                        var bb = new BlobBuilder();
                        var data = formData.imgData;
                        var byteArray = new Uint8Array(data.length);
                        for (var i = 0; i < data.length; i++) {
                            byteArray[i] = data.charCodeAt(i) & 0xff;
                        }
                        bb.append(byteArray.buffer);
                        fileWriter.write(bb.getBlob());
                    });
                }, errorHandler);
            }, errorHandler);
        },

        _initDOM: function() {
            var html = [
                '<input id="image_input" type="file" name="media" accept="image/*"/>',
                '<label for="x">X:</label>',
                '<input type="text" id="x" value="0" />',

                '<label for="y">Y:</label>',
                '<input type="text" id="y" value="0" />',

                '<label for="z">Z:</label>',
                '<input type="text" id="z" value="9999" />',

                '<label for="opacity">opacity:</label>',
                '<input type="text" id="opacity" value="0.5" />',

                '<label for="enabled">Enabled:</label>',
                '<input type="checkbox" id="enabled" />'
            ];
            var topDiv = document.createElement('div');
            topDiv.id = 'crxpp_inject';
            topDiv.className = 'crxpp_inject';
            topDiv.innerHTML = html.join('');
            this.element = document.body.insertBefore(topDiv, document.body.firstChild);
            this._initDOMEvents();
        },

        _initDOMEvents: function() {
            var elements = Array.prototype.slice.call(this.element.querySelectorAll('input')),
                textElements = Array.prototype.slice.call(this.element.querySelectorAll('input[type="text"]')),
                self = this;

            var initializeData = function() {
                /*elements.forEach(function(element) {
                    if (element.type == 'text') {
                        element.value = self.pageData[element.id];
                    } else if (element.type == 'checkbox') {
                        element.checked = self.pageData[element.id];
                    }
                });*/
            };

            var updateElements = function(imgData) {
                var formData = {};
                elements.forEach(function(element) {
                    if (element.type == 'text') {
                        formData[element.id] = element.value;
                    } else if (element.type == 'checkbox') {
                        formData[element.id] = element.checked;
                    }
                });
                if (imgData) {
                    formData.imgData = imgData;
                }
                formData.tabId = self.pageData.tabId;
                chrome.extension.sendRequest({
                    action: 'save',
                    formData: formData
                });
                self.renderImage(formData);
            };

            var onFormChange = function(e) {
                if (e.type == 'change') {
                    var file = e.target.files[0];
                    if (!file) {
                        return;
                    }
                    var reader = new FileReader();
                    reader.onload = function() {
                        enabled.checked = 'checked';
                        updateElements(reader.result);
                    };
                    reader.readAsBinaryString(file);
                } else {
                    if (e.keyCode && e.keyCode == 38 || e.keyCode == 40) {
                        return;
                    }
                    updateElements();
                }
            };

            initializeData();
            elements.forEach(function(element) {
                var eventType;
                if (element.type == 'text') {
                    eventType = 'keyup';
                } else if (element.type == 'file') {
                    eventType = 'change';
                } else if (element.type == 'checkbox') {
                    eventType = 'click';
                }
                element.addEventListener(eventType, onFormChange, false);
            });

            var pastTimeout = null;
            textElements.forEach(function(element) {
                element.addEventListener('keydown', function(e) {
                    var intValue = parseInt(element.value, 10),
                        increment = 0;
                    if (isNaN(intValue)) {
                        return true;
                    }
                    if (e.keyCode == 38) {
                        increment = 1;
                    } else if (e.keyCode == 40) {
                        increment = -1;
                    }
                    if (increment != 0) {
                        element.value = intValue + increment;
                        updateElements();
                    }
                }, false);
            });
        }
    };

    return ctor;
})();

new Crxpp();
