# videojs-youtube-annotations
Plugin for VideoJS to render YouTube annotations.

## Usage
HTML
```html
<!-- VideoJS automatically places the video in a <div id="avideo"></div> -->
<video id="avideo" class="video-js"></video>
<!-- include the styles -->
<link rel="stylesheet" type="text/css" href="dist.min.css">
```
Javascript
```javascript
const annotationXml = `
<?xml version="1.0" encoding="UTF-8" ?>
<document>
    <annotations> ... </annotations>
</document>`;

const video = videojs("avideo");
const videoContainer = document.getElementById("avideo");
video.ready(() => {
    videojs.registerPlugin("youtubeAnnotationsPlugin", youtubeAnnotationsPlugin);
    video.youtubeAnnotationsPlugin({annotationXml, videoContainer});
});
```

## Click Events

Each time an annotation that has a link attached to it is clicked, the event `__ar_annotation_click` is fired on `window`, with `e.detail.url` set to the url.
```javascript
window.addEventListener("__ar_annotation_click", e => {
    const url = e.detail.url;
    // redirect to the url
    window.location.href = url;
    // or provide a custom redirect
    // window.location.href = `www.example.com/redirect?url=${url}`;
});
