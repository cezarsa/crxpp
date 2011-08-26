var errorHandler = function(e) { console.log(e); };
window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
window.BlobBuilder = window.BlobBuilder || window.MozBlobBuilder || window.WebKitBlobBuilder;

var imgid = 'crxpp_overlay_img';
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  var overlayImg = document.getElementById(imgid);
  if(request.action == 'clear') {
    if(overlayImg) {
      overlayImg.parentNode.removeChild(overlayImg);
    }
    return;
  }
  if(request.action != 'update') {
    return;
  }
  if(request.url != window.location.href) {
    return;
  }
  if(!overlayImg) {
    overlayImg = document.createElement('img');
    overlayImg.id = imgid;
    overlayImg.style.position = 'absolute';
    overlayImg.style.opacity = '0.5';
    document.body.appendChild(overlayImg);
  }
  
  window.requestFileSystem(window.TEMPORARY, 5*1024*1024, function(fs) {
    fs.root.getFile('crxpp_overlay_img', {create: true}, function(fileEntry) {
      fileEntry.createWriter(function(fileWriter) {
        fileWriter.onwriteend = function(e) {
          overlayImg.src = fileEntry.toURL();
        };
        var bb = new BlobBuilder();
        var data = request.pageData.imgData;
        var byteArray = new Uint8Array(data.length);
        for (var i = 0; i < data.length; i++) {
            byteArray[i] = data.charCodeAt(i) & 0xff;
        }
        bb.append(byteArray.buffer);
        fileWriter.write(bb.getBlob());
      });
    }, errorHandler);
  }, errorHandler);
  
  overlayImg.style.zIndex = request.pageData.z + '';
  overlayImg.style.left = request.pageData.x + 'px';
  overlayImg.style.top = request.pageData.y + 'px';
});

chrome.extension.sendRequest({
  action: 'request',
  url: window.location.href
});
