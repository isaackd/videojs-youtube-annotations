class AnnotationParser {
	/* ATTRIBUTES FOUND IN YOUTUBE'S ANNOTATION FORMAT */
	static get baseAttributes() {
		return ["id", "type", "popup", "log_data", "itct"];
	}
	/* ATTRIBUTES THAT MUST BE PRESENT IN AR FORMAT */
	static get requiredAttributes() {
		return ["x", "y", "width", "height", "timeStart", "timeEnd"];
	}
	static get attributeMap() {
		return {
			type: "tp",
			x: "x",
			y: "y",
			width: "w",
			height: "h",
			timeStart: "ts",
			timeEnd: "te",
			text: "t",
			actionType: "at",
			actionUrl: "au",
			actionSeconds: "as",
		};
	}

	/* AR ANNOTATION FORMAT */
	deserializeAnnotation(serializedAnnotation) {
		const map = this.constructor.attributeMap;
		const attributes = serializedAnnotation.split(",");
		const annotation = {};
		for (const attribute of attributes) {
			const [ key, value ] = attribute.split("=");
			const mappedKey = this.getKeyByValue(map, key);

			let finalValue = "";

			if (mappedKey === "text" || mappedKey === "actionType" || mappedKey === "actionUrl"
				|| mappedKey === "type") {
				finalValue = decodeURIComponent(value);
			}
			else {
				finalValue = parseFloat(value, 10);
			}
			annotation[mappedKey] = finalValue;
		}
		return annotation;
	}
	serializeAnnotation(annotation) {
		if (this.checkForRequiredProperties(annotation)) {
			const map = this.constructor.attributeMap;
			let serialized = "";
			for (const key in annotation) {
				const mappedKey = map[key];
				if ((key === "text" || key === "actionType" || key === "actionUrl") 
					&& mappedKey && annotation[key]) {

					let text = encodeURIComponent(annotation[key]);
					serialized += `${mappedKey}=${text},`;
				}
				else if (mappedKey && 
					(key !== "text" && key !== "actionType" && key !== "actionUrl")) {

					serialized += `${mappedKey}=${annotation[key]},`;
				}
			}
			// remove trailing comma
			return serialized.substring(0, serialized.length - 1);
		}
		throw new Error("Invalid Annotation Format");
	}

	deserializeAnnotationList(serializedAnnotationString) {
		const serializedAnnotations = serializedAnnotationString.split(";");
		serializedAnnotations.length = serializedAnnotations.length - 1;
		const annotations = [];
		for (const annotation of serializedAnnotations) {
			annotations.push(this.deserializeAnnotation(annotation));
		}
		return annotations;
	}
	serializeAnnotationList(annotations) {
		let serialized = "";
		for (const annotation of annotations) {
			serialized += this.serializeAnnotation(annotation) + ";";
		}
		return serialized;
	}

	checkForRequiredProperties(annotation) {
		const requiredAttributes = this.constructor.requiredAttributes;
		for (const attr of requiredAttributes) {
			if (!annotation.hasOwnProperty(attr)) {
				throw new Error(`Annotation is missing required property \'${attr}\'`);
			}
		}
		return true;
	}

	/* PARSING YOUTUBE'S ANNOTATION FORMAT */
	xmlToDom(xml) {
		const parser = new DOMParser();
		const dom = parser.parseFromString(xml, "application/xml");
		return dom;
	}
	getAnnotationsFromXml(xml) {
		const dom = this.xmlToDom(xml);
		return dom.getElementsByTagName("annotation");
	}
	parseYoutubeFormat(annotationElements) {

		if (typeof annotationElements[Symbol.iterator] === 'function') {
			const annotations = [];
			for (const el of annotationElements) {
				const parsedAnnotation = this.parseYoutubeFormat(el);
				if (parsedAnnotation) annotations.push(parsedAnnotation);
			}
			return annotations;
		}
		else {
			const base = annotationElements;

			const attributes = this.getAttributesFromBase(base);

			let type;
			if (attributes.type === "pause") {
				return null;
			}
			else {
				type = attributes.type;
			}

			const text = this.getTextFromBase(base);
			const backgroundShape = this.getBackgroundShapeFromBase(base);
			if (!backgroundShape) return null;

			const action = this.getActionFromBase(base);

			const timeStart = backgroundShape.timeRange.start;
			const timeEnd = backgroundShape.timeRange.end;

			if (isNaN(timeStart) || isNaN(timeEnd)) {
				return null;
			}

			const obj = {
				x: backgroundShape.x, 
				y: backgroundShape.y, 
				width: backgroundShape.width, 
				height: backgroundShape.height, 
				timeStart,
				timeEnd,
				type,
				attributes
			};

			if (text) obj.text = text;
			if (action) {
			 	obj.actionType = action.type;
			 	if (action.type === "time") {
			 		obj.actionSeconds = action.seconds;
			 	}
			 	else if (action.type === "url") {
			 		obj.actionUrl = action.href;
			 	}
			} 

			return obj;
		}
	}
	getBackgroundShapeFromBase(base) {
		const movingRegion = base.getElementsByTagName("movingRegion")[0];
		if (!movingRegion) return null;
		const regionType = movingRegion.getAttribute("type");

		const regions = movingRegion.getElementsByTagName(`${regionType}Region`);
		const timeRange = this.extractRegionTime(regions);

		return {
			type: regionType,
			x: parseFloat(regions[0].getAttribute("x"), 10),
			y: parseFloat(regions[0].getAttribute("y"), 10),
			width: parseFloat(regions[0].getAttribute("w"), 10),
			height: parseFloat(regions[0].getAttribute("h"), 10),
			timeRange
		};
	}
	getAttributesFromBase(base) {
		const attributes = {};
		for (const attribute of this.constructor.baseAttributes) {
			attributes[attribute] = base.getAttribute(attribute);
		}
		return attributes;
	}
	getTextFromBase(base) {
		const textElement = base.getElementsByTagName("TEXT")[0];
		if (textElement) return textElement.textContent;
	}
	getActionFromBase(base) {
		const actionElement = base.getElementsByTagName("action")[0];
		if (!actionElement) return null;
		const typeAttr = actionElement.getAttribute("type");

		const urlElement = actionElement.getElementsByTagName("url")[0];
		if (!urlElement) return null;
		const href = urlElement.getAttribute("value");
		// only allow links to youtube
		// can be changed in the future
		if (href.startsWith("https://www.youtube.com/")) {
			const url = new URL(href);
			const srcVid = url.searchParams.get("src_vid");
			const toVid = url.searchParams.get("v");

			if (!srcVid || !toVid) return null;

			// check if it's a link to a new video
			// or just a timestamp
			if (srcVid === toVid) {
				let seconds = 0;
				const hash = url.hash;
				if (hash && hash.startsWith("#t=")) {
					const timeString = url.hash.split("#t=")[1];
					seconds = this.timeStringToSeconds(timeString);
				}
				return {type: "time", seconds}
			}
			else {
				return {type: "url", href};
			}

		}
		else {
			return null;
		}
	}
	extractRegionTime(regions) {
		let timeStart = regions[0].getAttribute("t");
		timeStart = this.hmsToSeconds(timeStart);

		let timeEnd = regions[regions.length - 1].getAttribute("t");
		timeEnd = this.hmsToSeconds(timeEnd);

		return {start: timeStart, end: timeEnd}
	}
	// https://stackoverflow.com/a/9640417/10817894
	hmsToSeconds(hms) {
	    let p = hms.split(":");
	    let s = 0;
	    let m = 1;

	    while (p.length > 0) {
	        s += m * parseFloat(p.pop(), 10);
	        m *= 60;
	    }
	    return s;
	}
	// from InstantView
	timeStringToSeconds(time) {
		let seconds = 0;

		const h = time.split("h");
	  	const m = (h[1] || time).split("m");
	  	const s = (m[1] || time).split("s");
		  
	  	if (h[0] && h.length === 2) seconds += parseInt(h[0], 10) * 60 * 60;
	  	if (m[0] && m.length === 2) seconds += parseInt(m[0], 10) * 60;
	  	if (s[0] && s.length === 2) seconds += parseInt(s[0], 10);

		return seconds;
	}
	/* OTHER */
	getKeyByValue(obj, value) {
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (obj[key] === value) {
					return key;
				}
			}
		}
	}
}
class AnnotationRenderer {
	constructor(annotations, container, postMessageOrigin, updateInterval = 1000) {
		if (!annotations) throw new Error("Annotation objects must be provided");
		if (!container) throw new Error("An element to contain the annotations must be provided");
		if (!postMessageOrigin) throw new Error("A postMessageOrigin must be provided");

		this.annotations = annotations;
		this.container = container;
		this.postMessageOrigin = postMessageOrigin;

		this.annotationsContainer = document.createElement("div");
		this.annotationsContainer.classList.add("__cxt-ar-annotations-container__");
		this.annotationsContainer.setAttribute("data-layer", "4");
		this.annotationsContainer.addEventListener("click", e => {
			this.annotationClickHandler(e);
		});
		this.container.prepend(this.annotationsContainer);
		this.createAnnotationElements();

		window.addEventListener("__annotations_restored_renderer_update", e => {
			this.update(e.detail.videoTime);
		});

		this.updateInterval = updateInterval;

	}
	createAnnotationElements() {
		for (const annotation of this.annotations) {
			const el = document.createElement("div");
			el.classList.add("__cxt-ar-annotation__");

			el.style.left = `${annotation.x}%`;
			el.style.top = `${annotation.y}%`;

			el.style.width = `${annotation.width}%`;
			el.style.height = `${annotation.height}%`;

			el.setAttribute("data-ar-type", annotation.type);

			if (annotation.text) {
				el.textContent = annotation.text;
				el.setAttribute("data-has-text", "");
			}

			el.setAttribute("hidden", "");

			annotation.__element = el;
			el.__anotation = annotation;
			this.annotationsContainer.append(el);
		}
	}
	update(videoTime) {
		for (const annotation of this.annotations) {
			const el = annotation.__element;
			const start = annotation.timeStart;
			const end = annotation.timeEnd;

			if (el.hasAttribute("hidden") && (videoTime >= start && videoTime < end)) {
				el.removeAttribute("hidden");
			}
			else if (!el.hasAttribute("hidden") && (videoTime < start || videoTime > end)) {
				el.setAttribute("hidden", "");
			}
		}
	}
	hideAll() {
		for (const annotation of this.annotations) {
			annotation.__element.setAttribute("hidden", "");
		}
	}
	start() {
		window.postMessage({type: "__annotations_restored_renderer_start", updateInterval: this.updateInterval}, this.postMessageOrigin);
	}
	stop() {
		window.postMessage({type: "__annotations_restored_renderer_stop"}, this.postMessageOrigin);
	}

	annotationClickHandler(e) {
		const annotationElement = e.target;
		const annotationData = annotationElement.__anotation;

		if (!annotationElement || !annotationData) return;

		if (annotationData.actionType === "time") {
			const seconds = annotationData.actionSeconds;
			this.setVideoTime(seconds);
		}
		else if (annotationData.actionType === "url") {
			window.postMessage({type: "__annotations_restored_renderer_urlclick", url: annotationData.actionUrl});
		}
	}

	setVideoTime(seconds) {
		window.postMessage({type: "__annotations_restored_renderer_seek_to", seconds}, this.postMessageOrigin);
	}

	setUpdateInterval(ms) {
		this.updateInterval = ms;
		this.stop();
		this.start();
	}
}
function youtubeAnnotationsPlugin(options) {
	if (!options.annotationXml) throw new Error("Annotation data must be provided");
	if (!options.videoContainer) throw new Error("A video container to overlay the data on must be provided");

	const xml = options.annotationXml;
	const parser = new AnnotationParser();
	const annotationElements = parser.getAnnotationsFromXml(xml);
	const annotations = parser.parseYoutubeFormat(annotationElements);

	includeStyles();

	const videoContainer = options.videoContainer;
	const renderer = new AnnotationRenderer(annotations, videoContainer, (options.postMessageOrigin || window.location.href), options.updateInterval);
	setupEventListeners(this, renderer);
	renderer.start();
}
function setupEventListeners(player, renderer) {
	if (!player) throw new Error("A video player must be provided");
	let rendererUpdateIntervalId;

	window.addEventListener("message", e => {
		const data = e.data;
		const type = data.type;
		if (type === "__annotations_restored_renderer_start") {
			rendererUpdateIntervalId = setInterval(() => {
				if (!video.paused()) {
					const videoTime = player.currentTime();
					const updateEvent = new CustomEvent("__annotations_restored_renderer_update", {
						detail: {videoTime}
					});
					window.dispatchEvent(updateEvent)
				}
			}, data.updateInterval);
		}
		else if (type === "__annotations_restored_renderer_stop") {
			clearInterval(rendererUpdateIntervalId);
			rendererUpdateIntervalId = null;
			renderer.hideAll();
		}
		else if (type === "__annotations_restored_renderer_seek_to") {
			player.currentTime(data.seconds);
			if (!player.paused()) {
				const videoTime = player.currentTime();
				const updateEvent = new CustomEvent("__annotations_restored_renderer_update", {
					detail: {videoTime}
				});
				window.dispatchEvent(updateEvent);
			}
		}
		else if (type === "__annotations_restored_renderer_urlclick") {
			window.location.href = data.url;
		}
	});

	player.on("pause", e => {
		if (rendererUpdateIntervalId !== null) {
			renderer.stop();
		}
	});
	player.on("play", e => {
		if (rendererUpdateIntervalId === null) {
			renderer.start();
		}
	});
}

function includeStyles() {
	const styleEl = document.createElement("style");
	styleEl.textContent = `
/* so the vjs controls are on top of annotation */
.vjs-control-bar {
	z-index: 2 !important; 
}

.__cxt-ar-annotations-container__ {
	position: absolute;

	width: 100%;
	height: 100%;

	top: 0px;
	left: 0px;
}

.__cxt-ar-annotation__ {
	position: absolute;
	display: flex;

	justify-content: center;
	align-items: center;

	box-sizing: border-box;

	font-family: Arial, sans-serif;
	font-size: 100%;
	color: white;
	cursor: pointer;
	background-color: rgba(0, 0, 0, 0.25);

	z-index: 1;
}
.__cxt-ar-annotation__:hover {
	border: 1px solid rgba(255, 255, 255, 0.50);
	background-color: rgba(0, 0, 0, 0.70);
}
.__cxt-ar-annotation__[hidden] {
	display: none !important;
}

.__cxt-ar-annotation__[data-ar-type="highlight"] {
	border: 1px solid rgba(255, 255, 255, 0.10);
	background-color: transparent;
}
.__cxt-ar-annotation__:hover[data-ar-type="highlight"] {
	border: 1px solid rgba(255, 255, 255, 0.50);
	background-color: transparent;
}
`;
	document.head.append(styleEl);
}
