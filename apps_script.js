// ═══════════════════════════════════════════════════════════════════════
//  APPS SCRIPT — Control de Flotilla FRAGO
//  Maneja 3 tipos de vehículo: Patrullas (P-xx), Motos (M-xx), Monopatín (MP-xx)
//  Pega este código en script.google.com y despliégalo como aplicación web.
// ═══════════════════════════════════════════════════════════════════════

// ── CONFIGURACIÓN (edita estos 4 valores) ──────────────────────────────
const DRIVE_FOLDER_ID = '11VbLdsojTkyHzqwchlRd3OWizR_gf5IJ'; // carpeta donde se guardan los PDF
const SHEET_ID        = '1Ff6DKmma0sGTkuL18K6L5DlS_LdoaAz4hZ2yo-EnJV0'; // hoja de cálculo del panel
const ALERT_EMAIL     = 'gabrielgomezcesar.frago@gmail.com'; // a dónde llegan las alertas
const SECRET_TOKEN    = ''; // opcional: deja vacío por ahora (ver nota al final)
// Credenciales para la revisión MENSUAL (solo Coordinador General).
// Cámbialas por las tuyas. No se exponen en los formularios; viven solo aquí.
const MENSUAL_USER    = 'gabriel';
const MENSUAL_PASS    = 'CAMBIA_ESTA_CONTRASENA';
// ── Parámetros operativos ──────────────────────────────────────────────
const HORAS_LIMITE_ENTREGA = 14; // horas antes de alertar una recepción sin entrega
// ── Notificaciones push (OneSignal) ────────────────────────────────────
// Crea una app en OneSignal para la Flotilla (aparte de la de Solicitudes) y
// copia aquí su App ID y su REST API Key (Settings → Keys & IDs).
const ONESIGNAL = {
  activo:  false, // pon true cuando tengas App ID y REST Key
  appId:   '',
  restKey: '',
};
function enviarPush(titulo, mensaje) {
  if (!ONESIGNAL.activo || !ONESIGNAL.appId || !ONESIGNAL.restKey) return false;
  try {
    UrlFetchApp.fetch('https://onesignal.com/api/v1/notifications', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'Authorization': 'Basic ' + ONESIGNAL.restKey },
      payload: JSON.stringify({
        app_id: ONESIGNAL.appId,
        included_segments: ['Subscribed Users'],
        headings: { en: titulo, es: titulo },
        contents: { en: mensaje, es: mensaje },
      }),
    });
    return true;
  } catch (e) { return false; }
}
// ── WhatsApp (puente CallMeBot) ────────────────────────────────────────
// Para activarlo: cada jefe o el GRUPO manda al número de CallMeBot el mensaje
// exacto que te indican, recibes una apikey, y la pones aquí. Guía: callmebot.com/blog/free-api-whatsapp-messages/
const WHATSAPP = {
  activo:   false, // pon true cuando tengas teléfono y apikey
  telefono: '',    // número (con lada, sin +) o ID de grupo que da CallMeBot
  apikey:   '',    // clave que te da CallMeBot
};
function enviarWhatsApp(mensaje) {
  if (!WHATSAPP.activo || !WHATSAPP.telefono || !WHATSAPP.apikey) return false;
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(WHATSAPP.telefono)
    + '&text=' + encodeURIComponent(mensaje) + '&apikey=' + encodeURIComponent(WHATSAPP.apikey);
  try { UrlFetchApp.fetch(url, { muteHttpExceptions: true }); return true; } catch (e) { return false; }
}
// Notifica por push (OneSignal) y WhatsApp si están activos, y siempre deja copia por correo.
function notificar(titulo, texto) {
  enviarPush(titulo, texto);
  enviarWhatsApp('*' + titulo + '*\n\n' + texto);
  try { MailApp.sendEmail(ALERT_EMAIL, titulo, texto); } catch (e) {}
}
// ═══════════════════════════════════════════════════════════════════════


// ── Esquema de columnas por tipo de vehículo ───────────────────────────
// Cada columna define su encabezado y de dónde sale el valor.
//   top:   campo de primer nivel del payload (data.responsable, etc.)
//   check: campo dentro de data.checklist
const SCHEMAS = {
  patrulla: {
    tab: 'Patrullas',
    validaKm: true,
    cols: [
      ['Fecha y hora', 'fecha'],
      ['Unidad',        ['top','unidad']],
      ['Tipo',          ['mov','tipo']],
      ['Jefe entrega',  ['mov','entrega']],
      ['Jefe recibe',   ['mov','recibe']],
      ['Cargo',         ['top','cargo']],
      ['Kilometraje',   ['km','kilometraje']],
      ['Gasolina',      ['top','gasolina_nivel']],
      ['Presión llantas', ['check','presion']],
      ['Llantas',       ['check','llantas']],
      ['Carrocería',    ['check','carroceria']],
      ['Vidrios',       ['check','vidrios']],
      ['Interior',      ['check','limpieza']],
      ['Daños interior',['check','int_danos']],
      ['Luces',         ['check','luces']],
      ['Frenos',        ['check','frenos']],
      ['Sirena/torreta',['check','sirena']],
      ['Radio',         ['check','radio']],
      ['Refacción/llave/gato', ['check','refaccion']],
      ['Documentación', ['check','documentacion']],
      ['Aceite',        ['check','aceite']],
      ['Refrigerante',  ['check','refrigerante']],
      ['Testigos',      ['check','testigos']],
      ['Observaciones', ['top','observaciones']],
      ['Detalles',      ['top','notas']],
      ['PDF',           'pdf'],
      ['Alertas',       'alerta'],
    ],
  },
  moto: {
    tab: 'Motos',
    validaKm: true,
    cols: [
      ['Fecha y hora', 'fecha'],
      ['Unidad',        ['top','unidad']],
      ['Tipo',          ['mov','tipo']],
      ['Jefe entrega',  ['mov','entrega']],
      ['Jefe recibe',   ['mov','recibe']],
      ['Cargo',         ['top','cargo']],
      ['Kilometraje',   ['km','kilometraje']],
      ['Gasolina',      ['top','gasolina_nivel']],
      ['Llanta delantera', ['check','llanta_del']],
      ['Llanta trasera',['check','llanta_tras']],
      ['Presión',       ['check','presion']],
      ['Cadena',        ['check','cadena']],
      ['Carrocería',    ['check','carroceria']],
      ['Espejos',       ['check','espejos']],
      ['Cajuela',       ['check','cajuela']],
      ['Equipo cajuela',['check','equipo_cajuela']],
      ['Luces',         ['check','luces']],
      ['Frenos',        ['check','frenos']],
      ['Claxon',        ['check','claxon']],
      ['Documentación', ['check','documentacion']],
      ['Testigos',      ['check','testigos']],
      ['Observaciones', ['top','observaciones']],
      ['Detalles',      ['top','notas']],
      ['PDF',           'pdf'],
      ['Alertas',       'alerta'],
    ],
  },
  monopatin: {
    tab: 'Monopatín',
    validaKm: false,
    cols: [
      ['Fecha y hora', 'fecha'],
      ['Unidad',        ['top','unidad']],
      ['Tipo',          ['mov','tipo']],
      ['Responsable',   ['top','responsable']],
      ['Batería',       ['top','bateria_nivel']],
      ['Conectado a carga', ['check','en_carga']],
      ['Estado físico', ['check','estado_fisico']],
      ['Ruedas',        ['check','ruedas']],
      ['Manubrio',      ['check','manubrio']],
      ['Plataforma',    ['check','deck']],
      ['Freno',         ['check','freno']],
      ['Acelerador',    ['check','acelerador']],
      ['Luces',         ['check','luces']],
      ['Plegado',       ['check','plegado']],
      ['Cable de carga',['check','cable_carga']],
      ['Observaciones', ['top','observaciones']],
      ['Detalles',      ['top','notas']],
      ['PDF',           'pdf'],
      ['Alertas',       'alerta'],
    ],
  },
};


// ── Punto de entrada de los formularios ────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Login de la cadencia mensual (Coordinador General).
    if (data.action === 'login') {
      const ok = (data.usuario === MENSUAL_USER && data.password === MENSUAL_PASS);
      return json({ status: ok ? 'ok' : 'error' });
    }

    // Seguridad opcional: si configuraste un token, debe coincidir.
    if (SECRET_TOKEN && data.token !== SECRET_TOKEN) {
      return json({ status: 'error', msg: 'Token inválido' });
    }

    // Si es un registro de mantenimiento preventivo, se procesa aparte.
    if (data.modo === 'mantenimiento') {
      return procesarMantenimiento(data);
    }

    const schema = schemaParaUnidad(data.unidad);
    if (!schema) return json({ status: 'error', msg: 'Unidad no reconocida: ' + data.unidad });

    // 1. Guardar el PDF en Drive
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.pdf), 'application/pdf', data.filename);
    const fileUrl = folder.createFile(blob).getUrl();

    // 2. Escribir la fila en la pestaña correcta
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreateTab(ss, schema);

    // Validación de kilometraje (continuidad)
    let alerta = '';
    if (schema.validaKm) {
      const aviso = validarKm(sheet, schema, data);
      if (aviso) alerta = aviso;
    }

    const fila = construirFila(schema, data, fileUrl, alerta);
    sheet.appendRow(fila);
    colorearFila(sheet, schema);

    return json({ status: 'ok', url: fileUrl, alerta: alerta });

  } catch (err) {
    // Si algo falla, avisa por correo para no perder el registro en silencio.
    try {
      MailApp.sendEmail(ALERT_EMAIL, 'Error en registro de flotilla',
        'Ocurrió un error al procesar un registro:\n\n' + err.toString());
    } catch (e2) {}
    return json({ status: 'error', msg: err.toString() });
  }
}

function doGet() {
  return json({ status: 'online' });
}


// ── Helpers ─────────────────────────────────────────────────────────────
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function schemaParaUnidad(unidad) {
  if (!unidad) return null;
  const u = unidad.toUpperCase();
  if (u.startsWith('MP-')) return SCHEMAS.monopatin; // revisar MP antes que M
  if (u.startsWith('M-'))  return SCHEMAS.moto;
  if (u.startsWith('P-'))  return SCHEMAS.patrulla;
  return null;
}

function getOrCreateTab(ss, schema) {
  let sheet = ss.getSheetByName(schema.tab);
  if (!sheet) sheet = ss.insertSheet(schema.tab);
  if (sheet.getLastRow() === 0) {
    const headers = schema.cols.map(c => c[0]);
    sheet.appendRow(headers);
    const hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setBackground('#0B1F3A').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function construirFila(schema, data, fileUrl, alerta) {
  const c = data.checklist || {};
  const mov = movimiento(data);
  return schema.cols.map(col => {
    const src = col[1];
    if (src === 'fecha') return new Date(data.timestamp || new Date());
    if (src === 'pdf')   return fileUrl;
    if (src === 'alerta') return alerta || '';
    if (Array.isArray(src)) {
      const [kind, key] = src;
      if (kind === 'top')   return data[key] || '';
      if (kind === 'km')    return data[key] ? Number(data[key]) : '';
      if (kind === 'check') return formatVal(c[key]);
      if (kind === 'mov')   return mov[key] || '';
    }
    return '';
  });
}

// Traduce el tipo de movimiento a quién entrega y quién recibe, con etiqueta legible.
function movimiento(data) {
  const t = data.tipo;
  if (t === 'cambio_turno') return { tipo: 'Cambio de turno', entrega: data.responsable || '', recibe: data.responsable2 || '' };
  if (t === 'toma')         return { tipo: 'Toma (salida)',    entrega: '(en reposo)',         recibe: data.responsable || '' };
  if (t === 'devolucion')   return { tipo: 'Devolución (reposo)', entrega: data.responsable || '', recibe: '(a reposo)' };
  // Compatibilidad con el modelo anterior
  if (t === 'recepcion')    return { tipo: 'Recepción', entrega: '', recibe: data.responsable || '' };
  if (t === 'entrega')      return { tipo: 'Entrega',   entrega: data.responsable || '', recibe: '' };
  return { tipo: t || '', entrega: data.responsable || '', recibe: data.responsable2 || '' };
}

function formatVal(val) {
  if (val === 'ok')      return '✓ OK';
  if (val === 'no')      return '✕ No OK';
  if (val === 'revisar') return '⚠ Revisar';
  if (val === undefined || val === null || val === '') return '—';
  return val; // valores como "1/2", "60-80%", etc. se dejan tal cual
}

function colorearFila(sheet, schema) {
  const row = sheet.getLastRow();
  if (row < 2) return;
  const n = schema.cols.length;
  const range = sheet.getRange(row, 1, 1, n);
  const values = range.getValues()[0];
  for (let i = 0; i < n; i++) {
    const cell = sheet.getRange(row, i + 1);
    const v = values[i];
    if (v === '✓ OK')        cell.setBackground('#C6EFCE').setFontColor('#276221');
    else if (v === '✕ No OK') cell.setBackground('#FFC7CE').setFontColor('#9C0006');
    else if (v === '⚠ Revisar') cell.setBackground('#FFEB9C').setFontColor('#9C5700');
  }
  // Resaltar la columna de Alertas si trae algo
  const idxAlerta = schema.cols.findIndex(c => c[1] === 'alerta');
  if (idxAlerta >= 0 && values[idxAlerta]) {
    sheet.getRange(row, idxAlerta + 1).setBackground('#FFC7CE').setFontColor('#9C0006').setFontWeight('bold');
  }
}

// Compara el km nuevo contra el último registrado de la misma unidad.
function validarKm(sheet, schema, data) {
  const kmNuevo = Number(data.kilometraje);
  if (!kmNuevo) return '';
  const colUnidad = schema.cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'unidad') + 1;
  const colKm     = schema.cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'kilometraje') + 1;
  if (colUnidad < 1 || colKm < 1) return '';
  const last = sheet.getLastRow();
  if (last < 2) return '';
  const datos = sheet.getRange(2, 1, last - 1, schema.cols.length).getValues();
  let kmPrevio = null;
  for (let i = datos.length - 1; i >= 0; i--) {
    if (datos[i][colUnidad - 1] === data.unidad) { kmPrevio = Number(datos[i][colKm - 1]); break; }
  }
  if (kmPrevio === null) return '';
  if (kmNuevo < kmPrevio) return 'KM menor al anterior (' + kmPrevio.toLocaleString() + ') — verificar';
  if (kmNuevo - kmPrevio > 1500) return 'Salto de KM grande (+' + (kmNuevo - kmPrevio).toLocaleString() + ') — verificar';
  return '';
}


// ═══════════════════════════════════════════════════════════════════════
//  ALERTA DE RECEPCIÓN SIN ENTREGA
//  Configura un disparador (trigger) por tiempo que ejecute esta función.
//  En el editor: reloj (Activadores) → Añadir activador →
//  función: revisarEntregasPendientes, evento: por tiempo, cada 2-4 horas.
// ═══════════════════════════════════════════════════════════════════════
function revisarEntregasPendientes() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ahora = new Date();
  const pendientes = [];

  Object.values(SCHEMAS).forEach(schema => {
    const sheet = ss.getSheetByName(schema.tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    const cols = schema.cols;
    const colUnidad = cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'unidad');
    const colTipo   = cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'tipo');
    const colFecha  = cols.findIndex(c => c[1] === 'fecha');
    const colRecibe = cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'recibe');
    const colResp   = cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'responsable');
    const colQuien  = colRecibe >= 0 ? colRecibe : colResp;
    const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, cols.length).getValues();

    // Último registro por unidad
    const ultimo = {};
    datos.forEach(fila => {
      const u = fila[colUnidad];
      const f = new Date(fila[colFecha]);
      if (!ultimo[u] || f > ultimo[u].fecha) {
        ultimo[u] = { tipo: fila[colTipo], fecha: f, resp: colQuien >= 0 ? fila[colQuien] : '' };
      }
    });

    Object.keys(ultimo).forEach(u => {
      const reg = ultimo[u];
      const horas = (ahora - reg.fecha) / 36e5;
      // "En uso" = el último movimiento NO fue una devolución a reposo.
      const tipoTxt = String(reg.tipo || '');
      const enReposo = tipoTxt.indexOf('Devoluci') >= 0;
      if (!enReposo && horas >= HORAS_LIMITE_ENTREGA) {
        pendientes.push(u + ' — último movimiento "' + tipoTxt + '" (' + (reg.resp || 's/d') + ') hace ' + Math.round(horas) + ' h, sin devolución ni nuevo cambio de turno.');
      }
    });
  });

  if (pendientes.length) {
    MailApp.sendEmail(ALERT_EMAIL, 'Unidades sin cerrar',
      'Estas unidades llevan tiempo en uso sin un registro de devolución o nuevo cambio de turno:\n\n' +
      pendientes.join('\n') +
      '\n\nRevisa el panel para confirmar.');
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  MANTENIMIENTO PREVENTIVO
// ═══════════════════════════════════════════════════════════════════════

// Flota completa (para los recordatorios)
const FLOTA = ['P-01','P-02','P-03','P-04','P-05','P-06','M-01','M-02','M-03','MP-01'];

// Intervalos por cadencia. dias = calendario; km = solo aplica a patrullas/motos.
// "Lo que ocurra primero" entre dias y km.
const INTERVALOS = {
  semanal:   { dias: 7,  km: null },
  quincenal: { dias: 15, km: null },
  mensual:   { dias: 30, km: 5000 },
};

const TAB_MANT = 'Mantenimiento';
const COLS_MANT = ['Fecha y hora','Unidad','Cadencia','Responsable','Cargo','Kilometraje',
                   'Puntos OK','Atención','Mal','Detalles','Observaciones','PDF'];

function procesarMantenimiento(data) {
  // Si es mensual, revalidar credenciales en el servidor (no confiar solo en el cliente).
  if (data.cadencia === 'mensual') {
    if (data.usuario !== MENSUAL_USER || data.password !== MENSUAL_PASS) {
      return json({ status: 'error', msg: 'La revisión mensual requiere credenciales válidas de Coordinador General' });
    }
  }

  // 1. Guardar PDF
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.pdf), 'application/pdf', data.filename);
  const fileUrl = folder.createFile(blob).getUrl();

  // 2. Pestaña de mantenimiento
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(TAB_MANT);
  if (!sheet) sheet = ss.insertSheet(TAB_MANT);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLS_MANT);
    sheet.getRange(1,1,1,COLS_MANT.length).setBackground('#0B1F3A').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // 3. Resumir resultados
  const res = data.resultados || [];
  const nOk = res.filter(r => r.estado === 'ok').length;
  const nAt = res.filter(r => r.estado === 'atencion').length;
  const nSv = res.filter(r => r.estado === 'mal').length;
  const detalles = res.filter(r => r.estado !== 'ok')
    .map(r => '[' + (r.estado === 'mal' ? 'MAL' : 'ATENCIÓN') + '] ' + r.item + (r.nota ? ': ' + r.nota : ''))
    .join('  |  ');

  sheet.appendRow([
    new Date(data.timestamp || new Date()),
    data.unidad, data.cadencia, data.responsable, data.cargo || '',
    data.kilometraje ? Number(data.kilometraje) : '',
    nOk, nAt, nSv, detalles, data.observaciones || '', fileUrl,
  ]);

  // 4. Colorear conteos
  const row = sheet.getLastRow();
  if (nAt > 0) sheet.getRange(row, 8).setBackground('#FFEB9C').setFontColor('#9C5700').setFontWeight('bold');
  if (nSv > 0) sheet.getRange(row, 9).setBackground('#FFC7CE').setFontColor('#9C0006').setFontWeight('bold');

  // 5. Confirmación push cuando se completa la revisión SEMANAL (estatus del domingo).
  if (data.cadencia === 'semanal') {
    let estado = 'sin novedad';
    if (nSv > 0) estado = nSv + ' punto(s) requieren servicio';
    else if (nAt > 0) estado = nAt + ' punto(s) con atención';
    enviarPush('✅ ' + data.unidad + ' envió su estatus',
      data.responsable + ' completó la revisión semanal de ' + data.unidad + ' · ' + estado + '.');
  }

  return json({ status: 'ok', url: fileUrl });
}


// ── Recordatorios de mantenimiento (disparador por tiempo, diario) ───────
// En el editor: reloj (Activadores) → Añadir activador →
// función: revisarMantenimientos, evento: por tiempo, cada día.
function revisarMantenimientos() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(TAB_MANT);
  const ahora = new Date();

  // Mapa: ultimo[unidad][cadencia] = { fecha, km }
  const ultimo = {};
  if (sheet && sheet.getLastRow() > 1) {
    const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, COLS_MANT.length).getValues();
    datos.forEach(f => {
      const u = f[1], cad = f[2], fecha = new Date(f[0]), km = Number(f[5]) || null;
      if (!ultimo[u]) ultimo[u] = {};
      if (!ultimo[u][cad] || fecha > ultimo[u][cad].fecha) ultimo[u][cad] = { fecha, km };
    });
  }

  const pendientes = [];
  FLOTA.forEach(u => {
    const esMonopatin = u.toUpperCase().indexOf('MP-') === 0;
    const kmActual = esMonopatin ? null : kmActualDeUnidad(ss, u);
    ['semanal','quincenal','mensual'].forEach(cad => {
      const intv = INTERVALOS[cad];
      const reg = ultimo[u] && ultimo[u][cad];
      let vence = false, motivo = '';
      if (!reg) {
        vence = true; motivo = 'nunca registrada';
      } else {
        const diasPasados = (ahora - reg.fecha) / 864e5;
        if (diasPasados >= intv.dias) { vence = true; motivo = Math.round(diasPasados) + ' días desde la última'; }
        if (!esMonopatin && intv.km && kmActual && reg.km && (kmActual - reg.km) >= intv.km) {
          vence = true; motivo = (motivo ? motivo + ' y ' : '') + '+' + (kmActual - reg.km).toLocaleString() + ' km';
        }
      }
      if (vence) pendientes.push('• ' + u + ' — ' + cad + ' (' + motivo + ')');
    });
  });

  if (pendientes.length) {
    notificar('Mantenimientos pendientes / vencidos',
      'Estas revisiones preventivas están pendientes o vencidas:\n\n' +
      pendientes.join('\n') +
      '\n\nSemanal y quincenal las hacen los jefes de turno; mensual el Coordinador General.');
  }
}

// Obtiene el kilometraje más reciente de una unidad desde su pestaña operativa.
function kmActualDeUnidad(ss, unidad) {
  const schema = schemaParaUnidad(unidad);
  if (!schema || !schema.validaKm) return null;
  const sheet = ss.getSheetByName(schema.tab);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const colUnidad = schema.cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'unidad');
  const colKm = schema.cols.findIndex(c => Array.isArray(c[1]) && c[1][1] === 'kilometraje');
  if (colUnidad < 0 || colKm < 0) return null;
  const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, schema.cols.length).getValues();
  let maxKm = null;
  datos.forEach(f => { if (f[colUnidad] === unidad) { const k = Number(f[colKm]); if (k && (maxKm === null || k > maxKm)) maxKm = k; } });
  return maxKm;
}


// ═══════════════════════════════════════════════════════════════════════
//  REPORTE SEMANAL DE ESTATUS (domingos)
//  El "estatus" que envían los jefes ES la revisión de mantenimiento SEMANAL.
//  Estas dos funciones recuerdan y verifican el cumplimiento cada semana.
//
//  Disparadores a crear (icono de reloj → Añadir activador):
//   1) recordatorioSemanal → semanal, día Domingo, 7-9am
//   2) reporteSemanal      → semanal, día Lunes, 8-9am
// ═══════════════════════════════════════════════════════════════════════

// Unidades que deben reportar: patrullas (P-) y motos (M-), NO el monopatín (MP-).
function unidadesQueReportan() {
  return FLOTA.filter(u => {
    const x = u.toUpperCase();
    return x.indexOf('P-') === 0 || (x.indexOf('M-') === 0 && x.indexOf('MP-') !== 0);
  });
}

// Devuelve, por unidad, la última revisión semanal de los últimos 'dias' días.
function reportesSemanalesRecientes(dias) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(TAB_MANT);
  const corte = new Date(Date.now() - dias * 864e5);
  const rep = {};
  if (sheet && sheet.getLastRow() > 1) {
    const d = sheet.getRange(2, 1, sheet.getLastRow() - 1, COLS_MANT.length).getValues();
    d.forEach(f => {
      if (f[2] !== 'semanal') return;          // col Cadencia
      const fecha = new Date(f[0]);            // col Fecha
      if (fecha < corte) return;
      const u = f[1];                          // col Unidad
      if (!rep[u] || fecha > rep[u].fecha) {
        rep[u] = { fecha: fecha, resp: f[3], ok: f[6], at: f[7], mal: f[8], det: f[9] };
      }
    });
  }
  return rep;
}

// DOMINGO: recordatorio para relanzar a los jefes (por el grupo de WhatsApp, etc.)
function recordatorioSemanal() {
  const rep = reportesSemanalesRecientes(6); // ¿ya reportaron en los últimos 6 días?
  const faltan = unidadesQueReportan().filter(u => !rep[u]);
  const detalle = faltan.length
    ? faltan.map(u => '• ' + u + ' — ' + (descFlota(u) || '')).join('\n')
    : 'Todas las unidades ya tienen su revisión semanal de esta semana.';
  const cuerpo =
    'RECORDATORIO — Revisión semanal de unidades (domingo)\n\n' +
    'Hoy toca que cada jefe de turno envíe el estatus de su unidad (patrullas y motos).\n' +
    'Se hace desde el portal: elige la unidad → Mantenimiento → Semanal.\n\n' +
    'Unidades que aún NO tienen revisión esta semana:\n' + detalle +
    '\n\nPuedes reenviar este mensaje al grupo de jefes de turno.';
  notificar('Recordatorio: estatus semanal de unidades', cuerpo);
}

// LUNES: reporte de cumplimiento + resumen de salud de cada unidad
function reporteSemanal() {
  const rep = reportesSemanalesRecientes(7);
  const reportaron = [], pendientes = [];
  const tz = Session.getScriptTimeZone();
  unidadesQueReportan().forEach(u => {
    const r = rep[u];
    if (r) {
      let l = u + ' — ' + r.resp + ' (' + Utilities.formatDate(r.fecha, tz, 'EEE d MMM') + ')  ·  OK ' + r.ok + ' / Atención ' + r.at + ' / Mal ' + r.mal;
      if (Number(r.mal) > 0) l += '   ⛔ requiere servicio';
      else if (Number(r.at) > 0) l += '   ⚠ con observaciones';
      reportaron.push(l);
    } else {
      pendientes.push('• ' + u + ' — ' + (descFlota(u) || ''));
    }
  });
  const cuerpo =
    'REPORTE SEMANAL DE ESTATUS DE UNIDADES\n' +
    'Semana al ' + Utilities.formatDate(new Date(), tz, 'd MMM yyyy') + '\n\n' +
    'REPORTARON (' + reportaron.length + ' de ' + unidadesQueReportan().length + '):\n' +
    (reportaron.length ? reportaron.map(l => '• ' + l).join('\n') : '(ninguna)') + '\n\n' +
    'SIN REPORTE (' + pendientes.length + '):\n' +
    (pendientes.length ? pendientes.join('\n') : 'Todas reportaron ✓') +
    '\n\nLos PDF y el detalle de cada revisión están en la pestaña Mantenimiento del panel.';
  notificar('Reporte semanal de unidades', cuerpo);
}

// Descripción corta de una unidad (para los correos). No lee la app; usa una tabla mínima.
function descFlota(codigo) {
  const M = {
    'P-01':'Vento 2017 · Lomas del Lago c2','P-02':'Virtus 2023 · Lomas del Lago c1',
    'P-03':'Virtus 2023 · Cumbres del Lago','P-04':'Saveiro con caja · Cumbres del Lago',
    'P-05':'Saveiro sin caja · Cumbres del Lago','P-06':'Virtus 2023 aut. · Coord. General',
    'M-01':'Moto · Lomas del Lago c1','M-02':'Moto · Lomas del Lago c2','M-03':'Moto · Balcones de Juriquilla',
  };
  return M[codigo] || '';
}


// DOMINGO POR LA TARDE / NOCHE: alerta de escalamiento.
// Solo manda mensaje si TODAVÍA hay unidades sin reportar. Sirve como segundo aviso.
// Disparador sugerido: semanal, día Domingo, 6-8pm.
function alertaPendientesSemanal() {
  const rep = reportesSemanalesRecientes(6);
  const faltan = unidadesQueReportan().filter(u => !rep[u]);
  if (!faltan.length) return; // todas cumplieron, no molesta
  const detalle = faltan.map(u => '• ' + u + ' — ' + (descFlota(u) || '')).join('\n');
  notificar('ALERTA: unidades sin estatus semanal',
    'Ya es tarde y estas unidades AÚN no han enviado su revisión semanal:\n\n' + detalle +
    '\n\nJefes de turno: entren al portal → su unidad → Mantenimiento → Semanal, antes de terminar el día.');
}
