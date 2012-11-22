(function() {

    var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    var Blob = window.Blob || window.WebKitBlob;
    var slice = Array.prototype.slice;
    var errorHandler = function(e) {
        (console.error || console.log)(e);
    };

    var PixelCheck = function() {
        this._checkEnabled();
    };

    PixelCheck.prototype = {
        onRequest: function(request) {
            if (request.action === 'toggle') {
                this.pageData = request.pageData;
                this.toggle();
            }
        },

        _checkEnabled: function() {
            chrome.extension.sendRequest({action: 'request'});
        },

        toggle: function() {
            if (!this.element) {
                this._initDOM();
                return;
            }
            this.element.style.display = (this.pageData.visible) ? '' : 'none';
        },

        renderImage: function(formData) {
            if (!this.overlayImg) {
                this.overlayImg = document.createElement('img');
                this.overlayImg.id = 'crxpp_overlay_img';
                this.overlayImg.style.position = 'absolute';
                this.overlayImg.style.pointerEvents = 'none';
                this._initOverlayEvents(this.overlayImg);
                document.body.appendChild(this.overlayImg);
            }

            this._updateImage(formData);

            if (!formData.imgData) {
                return;
            }

            requestFileSystem(window.TEMPORARY, 5 * 1024 * 1024, function(fs) {
                fs.root.getFile(this.overlayImg.id, {
                    create: true
                }, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {

                        var data = formData.imgData;
                        var byteArray = new Uint8Array(data.length);

                        for (var i = 0, dataLength = data.length; i < dataLength; i++) {
                            byteArray[i] = data.charCodeAt(i) & 0xff;
                        }

                        var blob = new Blob([byteArray.buffer]);
                        fileWriter.onwriteend = function(e) {
                            this.overlayImg.src = fileEntry.toURL();
                        }.bind(this);
                        fileWriter.write(blob);

                    }.bind(this));
                }.bind(this), errorHandler);
            }.bind(this), errorHandler);
        },

        _updateImage: function(formData) {
            this.overlayImg.style.display = (formData.enabled) ? '' : 'none';
            this.overlayImg.style.zIndex = formData.z;
            this.overlayImg.style.left = formData.x + 'px';
            this.overlayImg.style.top = formData.y + 'px';
            this.overlayImg.style.opacity = formData.opacity;
        },

        _initOverlayEvents: function(imgEl) {
            var diffX = 0, diffY = 0,
                xInput = this.element.querySelectorAll('[name="x"]')[0],
                yInput = this.element.querySelectorAll('[name="y"]')[0];

            var onMouseMove = function(e) {
                imgEl.style.left = (e.clientX - diffX) + 'px';
                imgEl.style.top = (e.clientY - diffY) + 'px';
            }.bind(this);

            var onMouseDown = function(e) {
                var imgX = parseInt(imgEl.style.left), imgY = parseInt(imgEl.style.top);
                diffX = e.clientX - imgX;
                diffY = e.clientY - imgY;
                e.preventDefault();
                imgEl.addEventListener('mouseup', onMouseUp, false);
                imgEl.addEventListener('mousemove', onMouseMove, false);
            }.bind(this);

            var onMouseUp = function(e) {
                xInput.value = parseInt(imgEl.style.left);
                yInput.value = parseInt(imgEl.style.top);
                this._updateFormAndRender();
                imgEl.removeEventListener('mouseup', onMouseUp, false);
                imgEl.removeEventListener('mousemove', onMouseMove, false);
            }.bind(this);

            imgEl.addEventListener('mousedown', onMouseDown, false);
        },

        _initDOM: function() {
            var html = [
                '<input name="image_input" type="file" name="media" accept="image/*"/>',
                '<label for="x">x:</label>',
                '<input type="text" name="x" value="0" />',

                '<label for="y">y:</label>',
                '<input type="text" name="y" value="0" />',

                '<label for="z">z:</label>',
                '<input type="text" name="z" value="9999" />',

                '<label for="opacity">opacity:</label>',
                '<input type="text" name="opacity" value="0.5" />',

                '<label for="enabled">enabled:</label>',
                '<input type="checkbox" name="enabled" />'
            ];

            var topDiv = document.createElement('div');
            topDiv.id = 'crxpp_inject';
            topDiv.className = 'crxpp_inject';
            topDiv.innerHTML = html.join('');
            this.element = document.body.insertBefore(topDiv, document.body.firstChild);
            this.formElements = slice.call(this.element.querySelectorAll('input'));
            this._initDOMEvents();
        },

        _updateFormAndRender: function(imgData){
            this.formElements.forEach(function(element) {
                if (element.type == 'text') {
                    this.pageData[element.name] = element.value;
                } else if (element.type == 'checkbox') {
                    this.pageData[element.name] = element.checked;
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
        },

        _initDOMEvents: function() {
            var textElements = Array.prototype.slice.call(this.element.querySelectorAll('input[type="text"]')),
                enabledEl = this.element.querySelectorAll('[name="enabled"]')[0],
                updateForm = this._updateFormAndRender.bind(this);

            var initializeData = function() {
                this.formElements.forEach(function(element) {
                    var data = this.pageData[element.name];
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
                    this._updateFormAndRender(this.pageData.imgData);
                }
            }.bind(this);

            var onFormChange = function(e) {
                if (e.type == 'change') {
                    var file = e.target.files[0];
                    if (!file) {
                        return;
                    }
                    var reader = new FileReader();
                    reader.onload = function() {
                        enabledEl.checked = true;
                        updateForm(reader.result);
                    };
                    reader.readAsBinaryString(file);
                } else {
                    if (e.keyCode && e.keyCode == 38 || e.keyCode == 40) {
                        return;
                    }
                    updateForm();
                }
            };

            initializeData();

            var elementToEventMap = {
                text: 'keyup',
                file: 'change',
                checkbox: 'click'
            };
            this.formElements.forEach(function(element) {
                element.addEventListener(elementToEventMap[element.type], onFormChange, false);
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
                        updateForm();
                    }
                }, false);
            });

            var activateDrag = {shift: 1, meta: 1};

            document.addEventListener('keydown', function(e) {
                if (activateDrag[e.keyIdentifier.toLowerCase()]) {
                    this.overlayImg.style.pointerEvents = '';
                }
            }.bind(this), false);
            document.addEventListener('keyup', function(e) {
                if (activateDrag[e.keyIdentifier.toLowerCase()]) {
                    this.overlayImg.style.pointerEvents = 'none';
                }
            }.bind(this), false);
        }
    };

    var pixelCheck = new PixelCheck();
    chrome.extension.onRequest.addListener(pixelCheck.onRequest.bind(pixelCheck));

})();

