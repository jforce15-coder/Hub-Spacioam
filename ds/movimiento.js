/* Spacio AM — Movimiento con sentido (ds/movimiento.md): las piezas que necesitan medir. Va con ds/movimiento.css. */
(function (w, d) {
  var quieto = function () { try { return w.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  function repite(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 500); }
  w.SAMov = {
    /* 4 · error: sacude (si se puede) y deja el borde rojo hasta que la persona vuelva a escribir */
    sacudir: function (el) {
      if (!el) return; el.classList.add("sa-mal"); if (!quieto()) repite(el, "sa-sacude");
      var f = function () { el.classList.remove("sa-mal"); el.removeEventListener("input", f); }; el.addEventListener("input", f);
    },
    /* 2 · el toque se siente */
    pop: function (el) { if (el && !quieto()) repite(el, "sa-pop"); },
    /* 6 · nada salta: el alto baja a 0 y lo de abajo sube; listo() se llama al terminar (ahí se quita del todo) */
    quitar: function (el, listo) {
      if (!el || quieto() || !el.offsetHeight) { if (listo) listo(); return; }
      el.style.height = el.offsetHeight + "px"; el.classList.add("sa-se-va"); void el.offsetWidth;
      el.style.height = "0px"; el.style.opacity = "0"; el.style.marginTop = el.style.marginBottom = "0px"; el.style.paddingTop = el.style.paddingBottom = "0px";
      var hecho = false, fin = function () { if (hecho) return; hecho = true; if (listo) listo(); else el.remove(); };
      el.addEventListener("transitionend", function (e) { if (e.propertyName === "height") fin(); }); setTimeout(fin, 320);
    },
    /* 5 · la píldora viaja: barra con position: relative y un hijo .sa-pildora; activo = el botón elegido */
    pildora: function (barra, activo) {
      if (!barra || !activo) return; var p = barra.querySelector(".sa-pildora");
      if (!p) { p = d.createElement("i"); p.className = "sa-pildora"; barra.insertBefore(p, barra.firstChild); }
      p.style.width = activo.offsetWidth + "px"; p.style.height = activo.offsetHeight + "px";
      p.style.transform = "translate(" + activo.offsetLeft + "px," + activo.offsetTop + "px)";
    },
    /* 3 · sale de donde tocaste: pone --origen en el panel según dónde está el botón que lo abrió */
    desde: function (panel, boton) {
      if (!panel || !boton) return; var a = boton.getBoundingClientRect(), b = panel.getBoundingClientRect();
      panel.style.setProperty("--origen", Math.round(a.left + a.width / 2 - b.left) + "px " + Math.round(a.top + a.height / 2 - b.top) + "px");
      if (!quieto()) repite(panel, "sa-desde");
    }
  };
})(window, document);
