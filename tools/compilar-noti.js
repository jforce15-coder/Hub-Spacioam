/* Compila js/noti-center.jsx -> js/noti-center.js para que el Hub no tenga que bajar Babel (3 MB) en cada arranque.
   Uso: npm i @babel/core @babel/preset-react && node tools/compilar-noti.js */
var fs = require("fs"), path = require("path"), babel = require("@babel/core");
var src = path.join(__dirname, "..", "js", "noti-center.jsx"), out = path.join(__dirname, "..", "js", "noti-center.js");
var r = babel.transformSync(fs.readFileSync(src, "utf8"), { filename: src, babelrc: false, configFile: false, presets: [["@babel/preset-react", { runtime: "classic" }]], compact: false, comments: true });
fs.writeFileSync(out, "/* GENERADO desde noti-center.jsx con tools/compilar-noti.js — no editar a mano. */\n" + r.code + "\n");
console.log("ok", out, r.code.length);
