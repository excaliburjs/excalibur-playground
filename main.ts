import * as monaco from "monaco-editor";
import * as lz from "lz-string";

const ts = (tag: any) => tag[0];

//@ts-ignore
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?url';


const defaultCode = ts`
import * as ex from 'excalibur';
console.log('hello world');

const game = new ex.Engine({
    canvasElementId: 'preview-canvas',
    displayMode: ex.DisplayMode.FitContainer,
    width: 600,
    height: 400
});

const a = new ex.Actor({
	pos: ex.vec(100, 100),
	width: 100,
	height: 100,
	color: ex.Color.Red
});

game.add(a);
game.start();`;

const getInitialCode = () => {
	const paramsString = window.location.search;
	const searchParams = new URLSearchParams(paramsString);
	const sharedCode = searchParams.get("code");
	console.log(sharedCode ? "has shared code": "no shared code");
	const code = sharedCode ? lz.decompressFromEncodedURIComponent(sharedCode) : defaultCode;

	return code;
}


// Solution: Configure Monaco Environment before importing
window.MonacoEnvironment = {
	getWorkerUrl: (moduleId: string, label: string) => {
		switch (label) {
			case 'typescript':
			case 'javascript':
				return tsWorker;
			default:
				return tsWorker;
		}
	}
} as any;

import exTypes from './dist/index.d.ts?raw';
monaco.languages.typescript.typescriptDefaults.addExtraLib(
	exTypes,
	"file:///index.d.ts"
);


// Check if TypeScript language server is working
const tsDefaults = monaco.languages.typescript.typescriptDefaults;

monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
	...tsDefaults.getCompilerOptions(),
	paths: {
		'excalibur': ['file:///index.d.ts']
	}
});

// These should return the default configurations
console.log('Compiler Options:', tsDefaults.getCompilerOptions());
console.log('Diagnostics Options:', tsDefaults.getDiagnosticsOptions());

const containerEl = document.getElementById("container")!;

const editor = monaco.editor.create(containerEl, {
	value: getInitialCode(),
	language: 'typescript',
	automaticLayout: true,
	theme: 'vs-dark' // todo use browser theme
});

/**
	* esm tagged template literal from Dr. Axel
	* https://2ality.com/2019/10/eval-via-import.html
	*/
function esm(templateStrings, ...substitutions) {
  let js = templateStrings.raw[0];
  for (let i=0; i<substitutions.length; i++) {
    js += substitutions[i] + templateStrings.raw[i+1];
  }
  return 'data:text/javascript;base64,' + btoa(js);
}

// const getWorker = await monaco.languages.typescript.getTypeScriptWorker();

const buildButtonEl = document.getElementById('build')! as HTMLButtonElement;
const debugButtonEl = document.getElementById('debug')! as HTMLButtonElement;
const shareButtonEl = document.getElementById('share')! as HTMLButtonElement;
const loadingEl = document.getElementsByClassName('loading')[0]! as HTMLDivElement;

const buildAndRun = async () => {
	loadingEl.style.display = 'block';

	const model = editor.getModel()!
	const getWorker = await monaco.languages.typescript.getTypeScriptWorker();

	const client = await getWorker();

	const runnanbleJs = await client.getEmitOutput(model.uri.toString(), false, false);
	const firstJs = runnanbleJs.outputFiles.find(f => f.name.endsWith('.js'));
	if (firstJs) {
		// Dr. Axel to the rescue
		// https://2ality.com/2019/10/eval-via-import.html
		try {
			await import(/* @vite-ignore */esm`${firstJs.text}`);
		} finally {
			loadingEl.style.display = 'none';
		}
	}
}

const toggleDebug = () => {
	(globalThis.___EXCALIBUR_DEVTOOL as any).toggleDebug();
}

const shareCode = () => {
	const code = editor.getModel().getValue();
	const encoded = `code=${lz.compressToEncodedURIComponent(code)}`;
	const url = `${window.location}?${encoded}`;
	console.log(code);
	console.log(url);
	navigator.clipboard.writeText(url);
	window.history.pushState({}, "", "?" + encoded);
}
shareButtonEl.addEventListener('click', shareCode);
debugButtonEl.addEventListener('click', toggleDebug);
buildButtonEl.addEventListener('click', buildAndRun);

window.addEventListener('keydown', (evt: KeyboardEvent) => {
	if (evt.code === 'Escape') {
		evt.preventDefault();
		buildButtonEl.focus();
		return false;

	}
	if ((evt.ctrlKey || evt.metaKey) && evt.code === 'KeyS') {
		evt.preventDefault();
		buildAndRun();
		return false;
	}
	
	if ((evt.ctrlKey || evt.metaKey) && evt.code === 'KeyD') {
		evt.preventDefault();
		toggleDebug();
		return false;
	}
	return true;
});
