# Alma orquestadora (modelo de negocio · referencia)

> Estado: **en construcción, sin dinero real** (Juan, 20-nov-2026: «Arranca el libro»). T1, el Libro de transacciones,
> está hecho (#935). Nada cobra ni paga. Las ramas 1 a 3 de la sección 5 ya son tinta; la 4 y la 5 siguen en niebla.

## 1. La idea (del video que pasó Juan)
«Quien trae al cliente gana más que quien hace el trabajo.» La organizadora de bodas no cocina: elige al banquetero,
la florista y la banda, y cobra por cada uno. El contratista reparte la obra y se queda la diferencia. El agente se lleva
una parte de cada presentación. Lo difícil no es el trabajo: es **encontrar a quien paga**. Quien controla eso controla
a todos los que vienen después. Dos pintores: uno pinta con sus manos (un oficio); el otro contesta las llamadas y
reparte el trabajo entre cinco pintores (un **canal**).

## 2. Por qué Spacio AM es el molde
Spacio AM ya tiene a todos los tipos de cliente de un negocio que se orquesta:

| Quién | Qué paga o qué recibe hoy | Dónde está en el Hub |
|---|---|---|
| Huésped | Paga la estadía (Airbnb, Booking, directo) | Reservas, Bandeja |
| Socio del apartamento | Recibe su monto a depositar; Spacio cobra su fee | Mi (Reporte del mes) |
| Proveedor | Limpieza, mantenimiento, lavandería, insumos, traslados | Contactos (carpeta Proveedores) |
| Equipo | Hace el trabajo de operación | Equipo |
| Prospecto | Futuro socio o futuro cliente | Grow, Bandeja |

El fee de Spacio sobre los socios ya es el modelo: Spacio no es dueña del apartamento, trae al huésped y se queda una parte.

## 3. El modelo: Alma es el canal y la caja
Alma (en el modo de negocio) **orquesta**: recibe el pedido, elige al proveedor, consigue el producto o el servicio y
**todo el dinero pasa por la Caja de Alma**. De cada transacción, Alma se queda la **Comisión de Alma**.

```
Cliente ──paga──▶ Caja de Alma ──paga (tarjeta o transferencia)──▶ Proveedor
                        │
                        └── se queda la Comisión de Alma (queda en el Libro de transacciones)
```

Tres formas de ganar (las tres del video):
1. **Margen** (el contratista): precio al cliente = costo del proveedor + comisión. Ej.: limpieza profunda, traslado.
2. **Referido** (la organizadora): el proveedor paga a Alma por cada trabajo que le manda. Ej.: tour, chef, fotógrafo.
3. **Gestión** (el agente): un porcentaje de lo que entra. Ej.: el fee de Spacio sobre el socio (ya existe).

Ejemplos en Spacio AM:
- Huésped pide traslado al aeropuerto → Alma cotiza con 2 proveedores → cobra al huésped un enlace de pago → paga al
  proveedor con la tarjeta de Alma → queda el margen.
- Socio necesita reparar el calentador → Alma pide 2 cotizaciones → el socio aprueba → Alma paga al técnico y lo
  descuenta del depósito del socio con su comisión de gestión.
- Llegada temprana, late checkout, lavandería, compras de bienvenida: el mismo flujo.

## 4. Reglas que no cambian (seguridad)
- **Ningún pago sin aprobación.** Alma prepara, Juan (o el socio, en lo suyo) dice sí. Más adelante, un tope por
  transacción y por mes que Juan fija; arriba del tope, siempre pregunta.
- **Una tarjeta virtual por proveedor** (o por categoría), con tope; nunca la tarjeta personal de Juan.
- **Todo queda en el Libro de transacciones**: quién pagó, a quién, cuánto, comisión, comprobante. Sin eso no se paga.
- Llaves del medio de pago en Ajustes → Llaves (Propiedades del script), nunca en el repo ni en el chat.
- La comisión se ve en el Gasto de Alma como **ingreso de Alma**, aparte del Gasto de empresa.

## 5. Árbol de decisiones (lo decide Juan antes de construir)
1. **Medio de cobro y pago** — **tinta (Juan, 20-nov-2026): Stripe.** Stripe (cobros con enlace + tarjetas virtuales con Stripe Issuing; España/UE) · un
   proveedor local de Guatemala para cobrar en quetzales · las dos. *Recomendación: empezar con Stripe en una sola
   moneda (USD) y sumar el local cuando haya volumen en quetzales.*
2. **¿El cliente ve la comisión?** — **tinta (Juan, 20-nov-2026): visible, «tarifa de gestión de Alma».** Visible («tarifa de gestión de Alma») · escondida en el precio (margen).
   *Recomendación: visible con huéspedes y socios (confianza), margen solo en paquetes cerrados.*
3. **¿A nombre de quién cobra Alma?** — **tinta (Juan, 20-nov-2026): Spacio AM.** Spacio AM (la empresa) · una empresa nueva para Alma. *Recomendación: Spacio AM
   al principio; separar cuando el modelo se use fuera de Spacio.*
4. **Riesgo si el proveedor falla** (niebla): Alma devuelve y reclama al proveedor · el proveedor responde directo al cliente.
5. **Cuánto es la comisión** por tipo (margen, referido, gestión) y por cliente (niebla). Mientras tanto, el Libro mide
   con un margen supuesto: `LIBRO_MARGEN_PCT` (Propiedad del script, 10 por defecto).

## 6. Rebanadas para cuando se retome (cada una se prueba sola)
1. ✅ **Libro de transacciones** (sin dinero real; #935 T1, `apps-script/libro.js`): hoja ALMA_TRANSACCIONES y
   herramienta `libro` (anotar · resumen; solo el principal, chat y WhatsApp) para que Alma anote cada compra o
   contratación que ya pasa hoy (quién, a quién, cuánto, comisión que habría tenido). Una vez al mes, desde el 11, trae
   de Mi el fee de Spacio (gestión real) y los insumos y reparaciones (comisión supuesta), sin duplicar. Robot:
   `libro_resumen` (solo lee) y `libro_importar`. Prueba: `.github/libro-transacciones.js`. Sirve para medir.
2. **Catálogo de proveedores**: tarifa, comisión acordada y calificación en la ficha del contacto.
3. **Cotización de Alma**: precio al cliente = costo + comisión, con la tarjeta de aprobación.
4. **Cobro**: enlace de pago al cliente (huésped o socio) y aviso cuando entra.
5. **Pago al proveedor**: tarjeta virtual con tope, solo con el sí; comprobante al Libro.
6. **Tablero de comisiones**: lo que Alma ganó en el mes, por tipo y por cliente, junto al Gasto de Alma.
