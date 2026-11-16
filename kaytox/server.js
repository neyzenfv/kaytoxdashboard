// KAYTOX — serveur sans dépendance (Node 18+)
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=process.env.PORT||3000,CODE=process.env.KAYTOX_CODE||"KAYTOX";
const DATA=process.env.DATA_DIR||path.join(__dirname,"data"),PUB=path.join(__dirname,"public"),UP=path.join(DATA,"uploads");
const SECRET=process.env.SESSION_SECRET||crypto.createHash("sha256").update("k:"+CODE).digest("hex");
fs.mkdirSync(UP,{recursive:true});
const DBF=path.join(DATA,"db.json");let db={};try{db=JSON.parse(fs.readFileSync(DBF,"utf8"))}catch{}
const persist=()=>{fs.writeFileSync(DBF+".tmp",JSON.stringify(db));fs.renameSync(DBF+".tmp",DBF)};
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
  if(p==="/api/items"&&req.method==="GET")return json(res,200,Object.values(db));
  let m=/^\/api\/items\/([\w-]{1,40})$/.exec(p);
  if(m&&req.method==="PUT"){const o=JSON.parse((await body(req,2e6)).toString());o.id=m[1];db[m[1]]=o;persist();return json(res,200,{ok:1})}
  if(m&&req.method==="DELETE"){delete db[m[1]];persist();return json(res,200,{ok:1})}
  if(p==="/api/upload"&&req.method==="POST"){const ext=EXT[(req.headers["content-type"]||"").split(";")[0]];if(!ext)return json(res,400,{error:"type"});
    const b=await body(req,1e7),n=crypto.randomBytes(8).toString("hex")+ext;fs.writeFileSync(path.join(UP,n),b);return json(res,200,{url:"/uploads/"+n})}
  if(p.startsWith("/uploads/"))return file(res,path.join(UP,path.basename(p)));
  return file(res,path.join(PUB,"index.html"));
}catch(e){json(res,500,{error:"serveur"})}}).listen(PORT,()=>console.log("KAYTOX sur http://localhost:"+PORT));
