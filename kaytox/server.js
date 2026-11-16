// KAYTOX — serveur sans framework (Node 20+)
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=process.env.PORT||3000,CODE=process.env.KAYTOX_CODE||"KAYTOX";
const DATA=process.env.DATA_DIR||path.join(__dirname,"data"),PUB=path.join(__dirname,"public"),UP=path.join(DATA,"uploads");
const SECRET=process.env.SESSION_SECRET||crypto.createHash("sha256").update("k:"+CODE).digest("hex");
const DBF=path.join(DATA,"db.json"),ON_VERCEL=!!process.env.VERCEL;
let db={},sql,blobSdk,tableReady;
if(!ON_VERCEL){fs.mkdirSync(UP,{recursive:true});try{db=JSON.parse(fs.readFileSync(DBF,"utf8"))}catch{}}
const database=async()=>{
  if(!ON_VERCEL)return null;
  if(!sql){
    const url=process.env.POSTGRES_URL||process.env.DATABASE_URL;
    if(!url)throw new Error("Missing POSTGRES_URL or DATABASE_URL");
    const{neon}=await import("@neondatabase/serverless");sql=neon(url);
  }
  if(!tableReady)tableReady=sql`CREATE TABLE IF NOT EXISTS kaytox_items (id text PRIMARY KEY, data jsonb NOT NULL)`.catch(error=>{tableReady=null;throw error});
  await tableReady;
  return sql;
};
const blob=async()=>{
  if(!ON_VERCEL)return null;
  if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN)throw new Error("Missing Vercel Blob store configuration");
  if(!blobSdk)blobSdk=await import("@vercel/blob");
  return blobSdk;
};
const getItems=async()=>ON_VERCEL?(await(await database())`SELECT data FROM kaytox_items`).map(row=>row.data):Object.values(db);
const saveItem=async(id,item)=>{
  if(ON_VERCEL){const query=await database();await query`INSERT INTO kaytox_items (id,data) VALUES (${id},${JSON.stringify(item)}::jsonb) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data`;return}
  db[id]=item;fs.writeFileSync(DBF+".tmp",JSON.stringify(db));fs.renameSync(DBF+".tmp",DBF);
};
const deleteItem=async id=>{
  if(ON_VERCEL){const query=await database();await query`DELETE FROM kaytox_items WHERE id=${id}`;return}
  delete db[id];fs.writeFileSync(DBF+".tmp",JSON.stringify(db));fs.renameSync(DBF+".tmp",DBF);
};
const sign=v=>v+"."+crypto.createHmac("sha256",SECRET).update(v).digest("hex");
const token=()=>sign("ok"+Date.now());
const valid=c=>{const m=/kx=([^;]+)/.exec(c||"");if(!m)return false;const i=m[1].lastIndexOf(".");if(i<0)return false;
  const a=Buffer.from(sign(m[1].slice(0,i))),b=Buffer.from(m[1]);return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const tries=new Map();
const MIME={".html":"text/html; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".js":"text/javascript",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif"};
const EXT={"image/png":".png","image/jpeg":".jpg","image/webp":".webp","image/gif":".gif"};
const body=(req,max)=>new Promise((ok,ko)=>{const c=[];let n=0;req.on("data",d=>{n+=d.length;if(n>max){ko(new Error("big"));req.destroy()}else c.push(d)});req.on("end",()=>ok(Buffer.concat(c)));req.on("error",ko)});
const json=(res,s,o)=>{res.writeHead(s,{"Content-Type":"application/json"});res.end(JSON.stringify(o))};
const file=(res,f)=>{fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end("404")}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","X-Content-Type-Options":"nosniff"});res.end(d)})};
http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,"http://x"),p=u.pathname,ip=req.headers["x-forwarded-for"]?.split(",")[0].trim()||req.socket.remoteAddress;
  if(p==="/api/login"&&req.method==="POST"){
    const t=tries.get(ip)||{n:0,r:Date.now()+9e5};if(Date.now()>t.r){t.n=0;t.r=Date.now()+9e5}
    if(t.n>=5)return json(res,429,{error:"limite"});
    let b={};try{b=JSON.parse((await body(req,1e4)).toString())}catch{}
    const a=crypto.createHash("sha256").update(String(b.code||"")).digest(),c=crypto.createHash("sha256").update(CODE).digest();
    if(crypto.timingSafeEqual(a,c)){tries.delete(ip);res.setHeader("Set-Cookie","kx="+token()+"; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000"+(req.headers["x-forwarded-proto"]==="https"?"; Secure":""));return json(res,200,{ok:1})}
    t.n++;tries.set(ip,t);return json(res,401,{error:"code"});
  }
  if(p==="/login"||p==="/manifest.json"||p==="/icon.svg"||p==="/icon.png"||p==="/sw.js")return file(res,path.join(PUB,p==="/login"?"login.html":p));
  if(!valid(req.headers.cookie)){if(p.startsWith("/api/")||p.startsWith("/uploads/"))return json(res,401,{error:"auth"});res.writeHead(302,{Location:"/login"});return res.end()}
  if(p==="/api/items"&&req.method==="GET")return json(res,200,await getItems());
  let m=/^\/api\/items\/([\w-]{1,40})$/.exec(p);
  if(m&&req.method==="PUT"){const o=JSON.parse((await body(req,2e6)).toString());o.id=m[1];await saveItem(m[1],o);return json(res,200,{ok:1})}
  if(m&&req.method==="DELETE"){await deleteItem(m[1]);return json(res,200,{ok:1})}
  if(p==="/api/upload"&&req.method==="POST"){const type=(req.headers["content-type"]||"").split(";")[0],ext=EXT[type];if(!ext)return json(res,400,{error:"type"});
    const b=await body(req,ON_VERCEL?4e6:1e7),n=crypto.randomBytes(8).toString("hex")+ext;
    if(ON_VERCEL){const store=await blob(),result=await store.put(n,b,{access:"private",contentType:type});return json(res,200,{url:"/uploads/"+result.pathname})}
    fs.writeFileSync(path.join(UP,n),b);return json(res,200,{url:"/uploads/"+n})}
  if(p.startsWith("/uploads/")){
    const name=p.slice("/uploads/".length);
    if(!/^[\w.-]+$/.test(name)){res.writeHead(404);return res.end("404")}
    if(!ON_VERCEL)return file(res,path.join(UP,name));
    const store=await blob(),result=await store.get(name,{access:"private"});
    if(!result||result.statusCode!==200){res.writeHead(404);return res.end("404")}
    res.writeHead(200,{"Content-Type":result.blob.contentType,"X-Content-Type-Options":"nosniff"});return res.end(Buffer.from(await new Response(result.stream).arrayBuffer()));
  }
  return file(res,path.join(PUB,"index.html"));
}catch(e){console.error(e);json(res,500,{error:"serveur"})}}).listen(PORT,()=>console.log("KAYTOX sur http://localhost:"+PORT));
