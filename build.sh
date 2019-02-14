cat src/annotationlib/dist/AnnotationParser.js <(echo) src/annotationlib/dist/AnnotationRenderer.js <(echo) src/index.js > dist/dist.js
cat src/annotationlib/dist/AnnotationRenderer.css > dist/dist.css

terser dist/dist.js -o dist/dist.min.js
csso dist/dist.css -o dist/dist.min.css
