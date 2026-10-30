/* ═══ BOTS DE PRUEBA → CLAUDE ════════════════════════════════════════════════════════════════════════════
   Los bots de prueba (pruebas/bots.mjs, flujo «Bots de prueba» de GitHub) usan cada página después de unir un cambio.
   Si encuentran problemas abren el aviso «🤖 Bots de prueba» (etiqueta bots-prueba). Cada hora el Hub lo revisa y, si
   es nuevo o cambió, se lo pasa a Claude como pedido de arreglo (como el equipo de Desarrollo): Claude abre el PR,
   los bots lo prueban en el mismo PR, Juan lo une, y al volver a probar cierran el aviso solos.
   Máximo un pedido por aviso cada 24 h (BOTS_PRUEBA_ENVIADOS). */
function botsPruebaRevisar_() {
  var lista = paraClaudeGh_('/repos/' + PARA_CLAUDE_REPO_ + '/issues?state=open&labels=bots-prueba&per_page=5');
  if (!lista || !lista.length) return;
  var p = PropertiesService.getScriptProperties(), env = {}; try { env = JSON.parse(p.getProperty('BOTS_PRUEBA_ENVIADOS') || '{}'); } catch (e) {}
  var adm = agPrincipal_(); if (!adm) return;
  lista.forEach(function (i) {
    var k = String(i.number), ya = env[k];
    if (ya && (ya.cambio === i.updated_at || Date.now() - ya.t < 24 * 3600000)) return;
    var cuerpo = String(i.body || ''), graves = Number((cuerpo.match(/\*\*(\d+) graves/) || [])[1] || 0);
    var r = paraClaudeCrear_(adm, { titulo: 'Arreglar lo que encontraron los bots de prueba (#' + i.number + ')', app: 'Hub', tipo: 'error', prioridad: graves ? 'alta' : 'normal',
      que_pasa: cuerpo.slice(0, 6000) + '\n\nAviso: ' + i.html_url,
      que_quiere: 'Que los bots ya no encuentren nada grave ni medio. Arregla en un PR (nunca a main): corre `cd pruebas && npm install && node bots.mjs` antes y después, y pega el informe final en el PR. Lo leve (botones chicos, texto cortado) arréglalo solo si es claro y no cambia el diseño.' });
    if (r && r.ok) { env[k] = { t: Date.now(), cambio: i.updated_at }; console.log('bots de prueba → Claude: #' + i.number); }
  });
  p.setProperty('BOTS_PRUEBA_ENVIADOS', JSON.stringify(env));
}
