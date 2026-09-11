import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createPreviewServer } from '../scripts/serve.mjs';
async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'weagent-web-test-'));
  for (const [name,bytes] of Object.entries({'index.html':'<h1>UI</h1>','styles.css':'body{}','app.js':'void 0;','src/scene.js':'export {};','src/resource-scope.js':'export {};','assets/mark.svg':'<svg/>','assets/shots/home.png':'png-fixture','vendor/three-loader.js':'export {};','vendor/three/three.module.js':'export {};','vendor/THREE-LICENSE.txt':'test license','config.local.json':'PRIVATE-FIXTURE','package.json':'PRIVATE-FIXTURE','scripts/private.mjs':'PRIVATE-FIXTURE'})) {
    const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);
  }
  const server=await createPreviewServer(root);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
  return {root,url:'http://127.0.0.1:'+server.address().port};
}
test('preview serves published page and UI assets with correct metadata',async t=>{
 const f=await fixture(t);for(const p of ['/','/index.html','/styles.css','/app.js','/src/scene.js','/src/resource-scope.js','/assets/mark.svg','/assets/shots/home.png','/vendor/three-loader.js','/vendor/three/three.module.js','/vendor/THREE-LICENSE.txt']) {
  const r=await fetch(f.url+p);assert.equal(r.status,200,p);assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.ok((await r.text()).length);
 }
});
for(const pathname of ['/config.local.json','/package.json','/scripts/private.mjs','/.env','/assets/private.json','/node_modules/x.js','/vendor/three/config.json'])test('preview refuses unpublished path '+pathname,async t=>{
 const f=await fixture(t);const r=await fetch(f.url+pathname);assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/PRIVATE-FIXTURE/);
});
test('allowed asset cannot redirect to a private file inside the Web root',async t=>{
 const f=await fixture(t);await fs.symlink(path.join(f.root,'config.local.json'),path.join(f.root,'assets','private.svg'));const r=await fetch(f.url+'/assets/private.svg');assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/PRIVATE-FIXTURE/);
});
test('HEAD and missing assets have distinct correct responses',async t=>{
 const f=await fixture(t);const r=await fetch(f.url,{method:'HEAD'});assert.equal(r.status,200);assert.equal(await r.text(),'');assert.equal(r.headers.get('content-length'),'11');
 assert.equal((await fetch(f.url+'/assets/not-found.png')).status,404);
});
test('preview rejects unsupported verbs and malformed escaped paths',async t=>{
 const f=await fixture(t);const r=await fetch(f.url,{method:'POST'});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');
 assert.equal((await fetch(f.url+'/%ZZ')).status,400);assert.equal((await fetch(f.url+'/assets/%00.png')).status,403);
});
