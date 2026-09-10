import assert from 'node:assert/strict';
import {extractWebuiLocaleFacts,localeCodesFromPaths,parseExplicitLocaleOptions} from '../tools/qb-locale-source.mjs';

const oldHtml=`
<select id="locale_select">
  <option value="en">English</option>
  <option value="zh_TW">正體中文</option>
  <option value="ja_JP">日本語</option>
</select>`;
assert.deepEqual(parseExplicitLocaleOptions(oldHtml),[
  {value:'en',label:'English'},
  {value:'zh_TW',label:'正體中文'},
  {value:'ja_JP',label:'日本語'}
]);
assert.deepEqual(extractWebuiLocaleFacts({preferencesSource:oldHtml,paths:[]}),{
  webuiLocales:[
    {value:'en',label:'English'},
    {value:'zh_TW',label:'正體中文'},
    {value:'ja_JP',label:'日本語'}
  ],
  webuiLocaleSource:'preferences-html'
});

const placeholder='<select id="locale_select">${LANGUAGE_OPTIONS}</select>';
assert.deepEqual(parseExplicitLocaleOptions(placeholder),[],'runtime placeholder is not an explicit historical locale table');
const paths=[
  'src/webui/www/translations/webui_zh_CN.ts',
  'src/webui/www/translations/webui_en.ts',
  'src/webui/www/translations/webui_ja.ts',
  'src/webui/www/translations/README.md',
  'src/lang/qbittorrent_ko.ts'
];
assert.deepEqual(localeCodesFromPaths(paths),['en','ja','zh_CN']);
assert.deepEqual(extractWebuiLocaleFacts({preferencesSource:placeholder,paths}),{
  webuiLocales:[{value:'en',label:null},{value:'ja',label:null},{value:'zh_CN',label:null}],
  webuiLocaleSource:'translation-resources'
});
assert.deepEqual(extractWebuiLocaleFacts({preferencesSource:'',paths:[]}),{webuiLocales:[],webuiLocaleSource:'unresolved'});

console.log('qB locale source contract passed: historical explicit options and modern translation resources stay exact-release source facts.');
