cat src/annotationlib/AnnotationParser.js src/annotationlib/AnnotationRenderer.js src/index.js > dist/dist.js
cat src/annotationlib/AnnotationRenderer.css > dist/dist.css

uglifyjs dist/dist.js > dist/dist.min.js
uglifycss dist/dist.css > dist/dist.min.css
