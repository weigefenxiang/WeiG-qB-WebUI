import assert from 'node:assert/strict';
import {enrichTorrentFileColumnProvenance} from '../tools/qb-detail-file-provenance.mjs';

const columns=['checked','name','size','progress','priority','remaining','availability'].map(key=>({key,dataProperties:[key]}));
const apiFields=['index','name','size','progress','priority','is_seed','piece_range','availability'];
const source=`
const updateData=(files)=>{
  const rows=files.map((file,index)=>{
    const ignore=(file.priority===FilePriority.Ignored);
    const row={
      fileId:index,
      checked:(ignore?TriState.Unchecked:TriState.Checked),
      fileName:file.name,
      name:Filesystem.fileName(file.name),
      size:file.size,
      progress:toFixedPointString(file.progress*100),
      priority:normalizePriority(file.priority),
      availability:file.availability
    };
    return row;
  });
};
class FileNode {
  isIgnored(){return this.priority===FilePriority.Ignored;}
  calculateRemaining(){this.remaining=this.isIgnored()?0:(this.size*(1-(this.progress/100)));}
}
`;
const enriched=enrichTorrentFileColumnProvenance(columns,source,apiFields,'qB5.2 Content synthetic');
assert.deepEqual(enriched.find(column=>column.key==='checked').dataProperties,['priority'],'checked must be source-proven from files API priority');
assert.deepEqual(enriched.find(column=>column.key==='remaining').dataProperties,['size','progress','priority'],'remaining must be source-proven from FileNode size/progress/priority');
for(const key of ['name','size','progress','priority','availability'])assert.deepEqual(enriched.find(column=>column.key===key).dataProperties,[key],`${key} must remain a direct files API field`);
assert.throws(()=>enrichTorrentFileColumnProvenance([{key:'checked',dataProperties:['checked']}],'const row={checked:true};',apiFields,'broken checked'),/no source-proven API derivation/);
assert.throws(()=>enrichTorrentFileColumnProvenance([{key:'remaining',dataProperties:['remaining']}],'class FileNode{calculateRemaining(){this.remaining=this.unknown;}}',apiFields,'broken remaining'),/derivation escaped API surface: unknown/);
console.log('qB Torrent file detail provenance contract passed: modern tree-only checked/remaining columns resolve to exact files API dependencies and unresolved derivations fail closed.');
