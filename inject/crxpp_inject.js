window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder;

var Crxpp = (function() {

    var errorHandler = function(e) {
        console.log(e);
    };

    var ctor = function() {
        this.pageData = null;
        this.overlayImageId = 'crxpp_overlay_img';
        this._bindEvents();
        this._checkEnabled();
    };

    ctor.prototype = {
        _bindEvents: function() {
            chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
                if (request.action == 'toggle') {
                    this.pageData = request.pageData;
                    this.toggle();
                }
            }.bind(this));
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
                return;
            }
            if (this.pageData.visible) {
                this.element.style.display = '';
            } else {
                this.element.style.display = 'none';
            }
        },

        renderImage: function(formData) {
            var imgId = this.overlayImageId,
                overlayImg = document.getElementById(imgId);

            if (!overlayImg) {
                overlayImg = document.createElement('img');
                overlayImg.id = imgId;
                overlayImg.style.position = 'absolute';
                document.body.appendChild(overlayImg);
            }
            if (!formData.enabled) {
                overlayImg.style.display = 'none';
            } else {
                overlayImg.style.display = '';
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
                textElements = Array.prototype.slice.call(this.element.querySelectorAll('input[type="text"]'));

            var initializeData = function() {
                elements.forEach(function(element) {
                    var data = this.pageData[element.id];
                    if (data === undefined) {
                        return true;
                    }
                    if (element.type == 'text') {
                        element.value = data;
                    } else if (element.type == 'checkbox') {
                        element.checked = data;
                    }
                }.bind(this));
                if (this.pageData.imgData) {
                    updateElements(this.pageData.imgData);
                }
            }.bind(this);

            var updateElements = function(imgData) {
                elements.forEach(function(element) {
                    if (element.type == 'text') {
                        this.pageData[element.id] = element.value;
                    } else if (element.type == 'checkbox') {
                        this.pageData[element.id] = element.checked;
                    }
                }.bind(this));
                if (imgData) {
                    this.pageData.imgData = imgData;
                } else {
                    delete this.pageData.imgData;
                }
                chrome.extension.sendRequest({
                    action: 'save',
                    pageData: this.pageData
                });
                this.renderImage(this.pageData);
            }.bind(this);

            var onFormChange = function(e) {
                if (e.type == 'change') {
                    var file = e.target.files[0];
                    if (!file) {
                        return;
                    }
                    var reader = new FileReader();
                    reader.onload = function() {
                        enabled.checked = true;
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

            textElements.forEach(function(element) {
                element.addEventListener('keydown', function(e) {
                    var floatValue = parseFloat(element.value, 10),
                        isDecimal = floatValue >= 0 && floatValue <= 1,
                        increment = 0,
                        newValue;
                    if (isNaN(floatValue)) {
                        return true;
                    }
                    if (e.keyCode == 38) {
                        increment = 1;
                    } else if (e.keyCode == 40) {
                        increment = -1;
                    }
                    if (increment != 0) {
                        if (isDecimal) {
                            newValue = (floatValue + (increment / 10)).toFixed(1);
                        } else {
                            newValue = (floatValue + increment).toFixed(0);
                        }
                        element.value = newValue;
                        updateElements();
                    }
                }, false);
            });
        }
    };

    return ctor;
})();

new Crxpp();
