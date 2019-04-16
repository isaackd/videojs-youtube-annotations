cat src/annotationlib/AnnotationParser.js src/annotationlib/AnnotationRenderer.js src/index.js > dist/dist.js
cat src/annotationlib/AnnotationRenderer.css > dist/dist.css

terser dist/dist.js > dist/dist.min.js
csso dist/dist.css > dist/dist.min.css
