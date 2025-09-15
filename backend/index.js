// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult, param } = require('express-validator');
const { Parser } = require('json2csv');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

/* =========================================================
   Seguridad básica y parsing
========================================================= */
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin }));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// Rate limit para login y recuperación
app.use('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/forgot-password', forgotLimiter);
app.use('/reset-password', forgotLimiter);

/* =========================================================
   Conexión MySQL
========================================================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sistema_energia_eolica',
  multipleStatements: false
});

db.connect((err) => {
  if (err) console.error('❌ Error al conectar con la BD:', err);
  else console.log('✅ Conectado a MySQL (sistema_energia_eolica)');
});

/* =========================================================
   Mailer opcional (SMTP)
========================================================= */
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  console.log('📧 SMTP habilitado para recuperación de contraseña');
} else {
  console.log('ℹ️ SMTP no configurado. Los enlaces de reset se imprimirán en consola.');
}

/* =========================================================
   Helpers de autenticación
========================================================= */
function firmarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', {
    expiresIn: process.env.JWT_EXPIRES || '4h'
  });
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return res.status(401).json({ error: 'Token faltante' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = payload; // { cuenta_id, rol }
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    const rolUser = (req.user.rol || '').toLowerCase().trim();
    const ok = rolesPermitidos.map(r => r.toLowerCase().trim()).includes(rolUser);
    if (!ok) return res.status(403).json({ error: 'Sin permisos' });
    next();
  };
}

/* =========================================================
   /login — bcrypt + JWT + bloqueo + bitácora
========================================================= */
app.post(
  '/login',
  [
    body('usuario').isString().trim().isLength({ min: 3, max: 120 }),
    body('contrasena').isString().isLength({ min: 3, max: 100 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errores: errors.array() });

    const { usuario, contrasena } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().slice(0, 45);
    const agente = (req.headers['user-agent'] || '').slice(0, 255);

    const sql = `
      SELECT 
        c.id_cuenta,
        c.usuario,
        c.contrasena AS hash,
        c.intentos_fallidos,
        c.bloqueado_hasta,
        r.nombre_rol
      FROM cuentas c
      JOIN usuarios u ON u.cuenta_id = c.id_cuenta
      JOIN roles r    ON r.id_rol    = u.rol_id
      WHERE c.usuario = ?
      LIMIT 1
    `;

    db.query(sql, [usuario], async (err, rows) => {
      if (err) return res.status(500).json({ success: false, mensaje: 'Error de servidor' });

      if (!rows || rows.length === 0) {
        db.query(
          'INSERT INTO bitacora_accesos (usuario_intento, ip, agente_usuario, exito, motivo) VALUES (?, ?, ?, 0, ?)',
          [usuario, ip, agente, 'usuario_no_encontrado']
        );
        return res.status(401).json({ success: false, mensaje: 'Usuario o contraseña incorrectos' });
      }

      const u = rows[0];

      if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) {
        db.query(
          'INSERT INTO bitacora_accesos (cuenta_id, usuario_intento, ip, agente_usuario, exito, motivo) VALUES (?, ?, ?, ?, 0, ?)',
          [u.id_cuenta, u.usuario, ip, agente, 'bloqueado']
        );
        return res.status(423).json({ success: false, mensaje: 'Cuenta bloqueada temporalmente. Intente más tarde.' });
      }

      const ok = await bcrypt.compare(contrasena, u.hash);
      if (!ok) {
        const fails = (u.intentos_fallidos || 0) + 1;
        if (fails >= 5) {
          db.query(
            'UPDATE cuentas SET intentos_fallidos = 0, bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id_cuenta = ?',
            [u.id_cuenta]
          );
        } else {
          db.query('UPDATE cuentas SET intentos_fallidos = ? WHERE id_cuenta = ?', [fails, u.id_cuenta]);
        }
        db.query(
          'INSERT INTO bitacora_accesos (cuenta_id, usuario_intento, ip, agente_usuario, exito, motivo) VALUES (?, ?, ?, ?, 0, ?)',
          [u.id_cuenta, u.usuario, ip, agente, 'contrasena_incorrecta']
        );
        return res.status(401).json({
          success: false,
          mensaje: fails >= 5
            ? 'Demasiados intentos. Cuenta bloqueada 15 minutos.'
            : 'Usuario o contraseña incorrectos'
        });
      }

      db.query('UPDATE cuentas SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id_cuenta = ?', [u.id_cuenta]);
      db.query(
        'INSERT INTO bitacora_accesos (cuenta_id, usuario_intento, ip, agente_usuario, exito, motivo) VALUES (?, ?, ?, ?, 1, ?)',
        [u.id_cuenta, u.usuario, ip, agente, 'login_ok']
      );

      const rol = (u.nombre_rol || '').toLowerCase().trim();
      const token = firmarToken({ cuenta_id: u.id_cuenta, rol });

      res.json({ success: true, token, rol, usuario: u.usuario });
    });
  }
);

// Verificar sesión
app.get('/me', requireAuth, (req, res) => {
  res.json({ cuenta_id: req.user.cuenta_id, rol: req.user.rol });
});

// Detalle del usuario logueado
app.get('/me-detalle', requireAuth, (req, res) => {
  const cuentaId = req.user.cuenta_id;

  const sql = `
    SELECT 
      c.id_cuenta,
      c.usuario AS login,
      r.nombre_rol AS rol,
      u.id_usuario,
      u.nombres,
      u.primer_apellido,
      u.segundo_apellido,
      u.telefono,
      u.direccion,
      u.fecha_nacimiento,
      u.email
    FROM usuarios u
    JOIN cuentas c ON c.id_cuenta = u.cuenta_id
    JOIN roles r   ON r.id_rol    = u.rol_id
    WHERE u.cuenta_id = ?
    LIMIT 1
  `;

  db.query(sql, [cuentaId], (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
    if (!rows || rows.length === 0) return res.status(404).json({ mensaje: 'No encontrado' });

    const u = rows[0];
    const nombre_completo = [u.nombres, u.primer_apellido, u.segundo_apellido].filter(Boolean).join(' ').trim();

    res.json({
      cuenta_id: u.id_cuenta,
      id_usuario: u.id_usuario,
      login: u.login,
      rol: (u.rol || '').toLowerCase(),
      nombres: u.nombres,
      primer_apellido: u.primer_apellido,
      segundo_apellido: u.segundo_apellido,
      telefono: u.telefono,
      direccion: u.direccion,
      fecha_nacimiento: u.fecha_nacimiento,
      email: u.email || null,
      nombre_completo
    });
  });
});

/* =========================================================
   Recuperación de contraseña (Forgot / Reset)
========================================================= */
app.post('/forgot-password', [ body('usuario').isString().trim().isLength({ min: 3, max: 120 }) ], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

  const { usuario } = req.body;

  const sql = `
    SELECT c.id_cuenta, c.usuario, u.email
    FROM cuentas c
    JOIN usuarios u ON u.cuenta_id = c.id_cuenta
    WHERE c.usuario = ?
    LIMIT 1
  `;
  db.query(sql, [usuario], async (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error en servidor' });

    const generic = { mensaje: 'Si el usuario existe, te enviaremos un enlace de recuperación.' };
    if (!rows || rows.length === 0) return res.json(generic);

    const u = rows[0];
    const token = crypto.randomBytes(20).toString('hex');
    db.query(
      'UPDATE cuentas SET reset_token=?, reset_expires=DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id_cuenta=?',
      [token, u.id_cuenta],
      async (e2) => {
        if (e2) return res.status(500).json({ mensaje: 'No se pudo generar el token' });

        const base = process.env.APP_BASE_URL || 'http://localhost:3000';
        const resetUrl = `${base}/reset-password/${token}`;
        const destino = (u.email || u.usuario || '').trim();

        if (mailer && destino) {
          try {
            await mailer.sendMail({
              from: `"Sistema Eólico" <${process.env.SMTP_USER}>`,
              to: destino,
              subject: 'Recupera tu contraseña',
              html: `
                <p>Hola ${u.usuario},</p>
                <p>Usa este enlace para restablecer tu contraseña (expira en 15 minutos):</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
              `,
            });
          } catch {
            console.log('[RESET LINK]', resetUrl);
          }
        } else {
          console.log('[RESET LINK]', resetUrl);
        }
        return res.json(generic);
      }
    );
  });
});

app.post('/reset-password', [
  body('token').isString().trim().isLength({ min: 10 }),
  body('nueva_contrasena').isString().isLength({ min: 8, max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });
  const { token, nueva_contrasena } = req.body;

  const find = `
    SELECT id_cuenta
    FROM cuentas
    WHERE reset_token = ?
      AND reset_expires IS NOT NULL
      AND reset_expires > NOW()
    LIMIT 1
  `;
  db.query(find, [token], async (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
    if (!rows || rows.length === 0) return res.status(400).json({ mensaje: 'Token inválido o expirado' });

    const idCuenta = rows[0].id_cuenta;
    const hash = await bcrypt.hash(nueva_contrasena, 12);

    db.query(
      'UPDATE cuentas SET contrasena = ?, reset_token=NULL, reset_expires=NULL WHERE id_cuenta = ?',
      [hash, idCuenta],
      (e2) => {
        if (e2) return res.status(500).json({ mensaje: 'No se pudo actualizar la contraseña' });
        return res.json({ mensaje: 'Contraseña actualizada correctamente' });
      }
    );
  });
});

/* =========================================================
   USUARIOS — admin
========================================================= */
app.get('/usuarios', requireAuth, requireRole('administrador'), (req, res) => {
  const busqueda = (req.query.busqueda || '').toString().trim();

  let sql = `
    SELECT 
      u.*,
      c.usuario,
      r.nombre_rol,
      e.id_eolico      AS eolico_id,
      e.codigo         AS eolico_codigo,
      e.activo         AS eolico_habilitado
    FROM usuarios u
    JOIN cuentas c ON c.id_cuenta = u.cuenta_id
    JOIN roles   r ON r.id_rol    = u.rol_id
    LEFT JOIN eolicos e ON e.usuario_id = u.id_usuario
  `;
  const params = [];

  if (busqueda) {
    sql += `
      WHERE 
        u.id_usuario LIKE ?
        OR c.usuario LIKE ?
        OR u.nombres LIKE ?
        OR u.primer_apellido LIKE ?
        OR u.segundo_apellido LIKE ?
        OR u.ci LIKE ?
        OR u.telefono LIKE ?
        OR u.direccion LIKE ?
        OR e.codigo LIKE ?
    `;
    const like = `%${busqueda}%`;
    params.push(like, like, like, like, like, like, like, like, like);
  }

  sql += ' ORDER BY u.id_usuario ASC';

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// Crear usuario
app.post(
  '/usuarios',
  requireAuth,
  requireRole('administrador'),
  [
    body('usuario').isEmail().withMessage('usuario debe ser un correo válido').isLength({ max: 120 })
      .customSanitizer(v => String(v||'').toLowerCase().trim()),
    body('contrasena').isString().isLength({ min: 8, max: 100 }),
    body('rol').isString().trim().isIn(['administrador', 'usuario']),
    body('nombres').optional().isString().trim().isLength({ max: 60 }),
    body('primer_apellido').optional().isString().trim().isLength({ max: 60 }),
    body('segundo_apellido').optional().isString().trim().isLength({ max: 60 }),
    body('ci').optional().isString().trim().isLength({ max: 20 }),
    body('telefono').optional().isString().trim().isLength({ max: 25 }),
    body('direccion').optional().isString().trim().isLength({ max: 255 }),
    body('fecha_nacimiento').optional().isISO8601().toDate(),
    body('email').optional().isEmail().isLength({ max: 120 })
      .customSanitizer(v => String(v||'').toLowerCase().trim()),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

    const {
      usuario, contrasena, rol,
      nombres, primer_apellido, segundo_apellido,
      ci, telefono, direccion, fecha_nacimiento, email
    } = req.body;

    db.query('SELECT id_rol FROM roles WHERE nombre_rol = ? LIMIT 1', [rol], async (e1, rRol) => {
      if (e1) return res.status(500).json({ mensaje: 'Error buscando rol' });
      if (!rRol.length) return res.status(400).json({ mensaje: 'Rol inválido' });
      const rol_id = rRol[0].id_rol;

      db.query('SELECT id_cuenta FROM cuentas WHERE usuario = ? LIMIT 1', [usuario], async (e2, rDup) => {
        if (e2) return res.status(500).json({ mensaje: 'Error verificando usuario' });
        if (rDup.length) return res.status(409).json({ mensaje: 'El usuario ya existe' });

        const hash = await bcrypt.hash(contrasena, 12);

        db.beginTransaction((txErr) => {
          if (txErr) return res.status(500).json({ mensaje: 'No se pudo iniciar la transacción' });

          db.query('INSERT INTO cuentas (usuario, contrasena) VALUES (?, ?)', [usuario, hash], (e3, rCta) => {
            if (e3) { db.rollback(()=>{}); return res.status(500).json({ mensaje: 'Error creando cuenta' }); }

            const cuenta_id = rCta.insertId;
            const sqlU = `
              INSERT INTO usuarios
                (cuenta_id, rol_id, nombres, primer_apellido, segundo_apellido, ci, fecha_nacimiento, telefono, direccion, email)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const emailFinal = email || usuario;
            db.query(sqlU, [
              cuenta_id, rol_id,
              nombres || null, primer_apellido || null, segundo_apellido || null,
              ci || null, fecha_nacimiento || null, telefono || null, direccion || null, emailFinal || null
            ], (e4) => {
              if (e4) { db.rollback(()=>{}); return res.status(500).json({ mensaje: 'Error creando usuario' }); }

              const detalle = JSON.stringify({ usuario, rol });
              db.query(
                'INSERT INTO auditoria_usuarios (actor_cuenta_id, accion, objetivo_cuenta_id, detalle) VALUES (?, "CREAR", ?, ?)',
                [req.user.cuenta_id, cuenta_id, detalle],
                (e5) => {
                  if (e5) { db.rollback(()=>{}); return res.status(500).json({ mensaje: 'Error de auditoría' }); }
                  db.commit((cErr) => {
                    if (cErr) { db.rollback(()=> res.status(500).json({ mensaje: 'Error al confirmar transacción' })); return; }
                    res.status(201).json({ mensaje: 'Usuario creado correctamente' });
                  });
                }
              );
            });
          });
        });
      });
    });
  }
);

// Actualizar usuario
app.put(
  '/usuarios/:id',
  requireAuth,
  requireRole('administrador'),
  [
    param('id').isInt({ min: 1 }),
    body('nombres').optional().isString().trim().isLength({ max: 60 }),
    body('primer_apellido').optional().isString().trim().isLength({ max: 60 }),
    body('segundo_apellido').optional().isString().trim().isLength({ max: 60 }),
    body('ci').optional().isString().trim().isLength({ max: 20 }),
    body('telefono').optional().isString().trim().isLength({ max: 25 }),
    body('direccion').optional().isString().trim().isLength({ max: 255 }),
    body('fecha_nacimiento').optional().isISO8601().toDate(),
    body('rol').optional().isString().trim().isIn(['administrador','usuario']),
    body('email').optional().isEmail().isLength({ max: 120 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

    const { id } = req.params;
    const {
      nombres, primer_apellido, segundo_apellido,
      ci, fecha_nacimiento, telefono, direccion,
      rol, email,
    } = req.body;

    if (!rol) {
      const sql = `
        UPDATE usuarios SET 
          nombres = ?, 
          primer_apellido = ?, 
          segundo_apellido = ?, 
          ci = ?, 
          fecha_nacimiento = ?, 
          telefono = ?, 
          direccion = ?,
          email = ?
        WHERE id_usuario = ?
      `;
      db.query(sql, [nombres || null, primer_apellido || null, segundo_apellido || null, ci || null, fecha_nacimiento || null, telefono || null, direccion || null, email || null, id], (err) => {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
      });
      return;
    }

    db.beginTransaction((txErr) => {
      if (txErr) return res.status(500).json({ mensaje: 'No se pudo iniciar la transacción' });

      db.query('SELECT id_rol FROM roles WHERE nombre_rol = ? LIMIT 1', [rol], (e1, rRol) => {
        if (e1) { db.rollback(()=>{}); return res.status(500).json({ mensaje: 'Error buscando rol' }); }
        if (!rRol.length) { db.rollback(()=>{}); return res.status(400).json({ mensaje: 'Rol inválido' }); }

        const rol_id = rRol[0].id_rol;
        const sql = `
          UPDATE usuarios SET 
            rol_id = ?, 
            nombres = ?, 
            primer_apellido = ?, 
            segundo_apellido = ?, 
            ci = ?, 
            fecha_nacimiento = ?, 
            telefono = ?, 
            direccion = ?,
            email = ?
          WHERE id_usuario = ?
        `;
        db.query(sql, [rol_id, nombres || null, primer_apellido || null, segundo_apellido || null, ci || null, fecha_nacimiento || null, telefono || null, direccion || null, email || null, id], (e2) => {
          if (e2) { db.rollback(()=>{}); return res.status(500).json({ mensaje: 'Error al actualizar usuario' }); }

          const detalle = JSON.stringify({ id_usuario: id, nuevo_rol: rol });
          db.query('INSERT INTO auditoria_usuarios (actor_cuenta_id, accion, objetivo_cuenta_id, detalle) VALUES (?, "ACTUALIZAR", NULL, ?)', [req.user.cuenta_id, detalle], (e3) => {
            if (e3) { db.rollback(()=>{}); return res.status(500).json({ mensaje: 'Error de auditoría' }); }
            db.commit((cErr) => {
              if (cErr) return db.rollback(()=> res.status(500).json({ mensaje: 'Error al confirmar transacción' }));
              res.sendStatus(200);
            });
          });
        });
      });
    });
  }
);

// Eliminar usuario
app.delete('/usuarios/:id', requireAuth, requireRole('administrador'), [param('id').isInt({ min: 1 })], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

  const { id } = req.params;
  db.query('DELETE FROM usuarios WHERE id_usuario = ?', [id], (err) => {
    if (err) return res.status(500).send(err);
    res.sendStatus(200);
  });
});

/* =========================================================
   Resumen / Alertas
========================================================= */
app.get('/resumen', requireAuth, (req, res) => {
  const esAdmin = (req.user.rol || '').toLowerCase() === 'administrador';
  const userId = req.query.userId ? Number(req.query.userId) : null;

  if (!esAdmin) {
    const sql = `
      SELECT lr.*
      FROM lecturas_resumen lr
      JOIN usuarios u ON u.id_usuario = lr.usuario_id
      WHERE u.cuenta_id = ?
      ORDER BY lr.fecha_lectura DESC
      LIMIT 100
    `;
    db.query(sql, [req.user.cuenta_id], (err, rows) => {
      if (err) return res.status(500).send('Error en servidor');
      res.json(rows);
    });
    return;
  }

  if (Number.isInteger(userId) && userId > 0) {
    const sqlAdmFiltrado = `
      SELECT * 
      FROM lecturas_resumen 
      WHERE usuario_id = ?
      ORDER BY fecha_lectura DESC
      LIMIT 100
    `;
    db.query(sqlAdmFiltrado, [userId], (err, rows) => {
      if (err) return res.status(500).send('Error en servidor');
      res.json(rows);
    });
    return;
  }

  db.query('SELECT * FROM lecturas_resumen ORDER BY fecha_lectura DESC LIMIT 100', (err, rows) => {
    if (err) return res.status(500).send('Error en servidor');
    res.json(rows);
  });
});

app.get('/alertas', requireAuth, (req, res) => {
  const esAdmin = (req.user.rol || '').toLowerCase() === 'administrador';
  const where = `(
    (lr.bateria IS NOT NULL AND lr.bateria < 20)
    OR (lr.voltaje IS NOT NULL AND lr.voltaje < 10)
  )`;

  if (!esAdmin) {
    const sql = `
      SELECT lr.voltaje, lr.bateria, lr.consumo, lr.fecha_lectura
      FROM lecturas_resumen lr
      JOIN usuarios u ON u.id_usuario = lr.usuario_id
      WHERE u.cuenta_id = ? AND ${where}
      ORDER BY lr.fecha_lectura DESC
      LIMIT 10
    `;
    db.query(sql, [req.user.cuenta_id], (err, rows) => {
      if (err) return res.status(500).send('Error en servidor');
      res.json(rows);
    });
    return;
  }

  const sqlAdmin = `
    SELECT voltaje, bateria, consumo, fecha_lectura
    FROM lecturas_resumen lr
    WHERE ${where}
    ORDER BY fecha_lectura DESC
    LIMIT 10
  `;
  db.query(sqlAdmin, (err, rows) => {
    if (err) return res.status(500).send('Error en servidor');
    res.json(rows);
  });
});

/* =========================================================
   Reporte CSV (usuarios)
========================================================= */
app.get('/reporte-usuarios', requireAuth, requireRole('administrador'), (req, res) => {
  db.query('SELECT nombres, primer_apellido, segundo_apellido, ci, fecha_nacimiento, telefono, direccion, email FROM usuarios', (err, results) => {
    if (err) return res.status(500).send('Error en servidor');
    const fields = ['nombres','primer_apellido','segundo_apellido','ci','fecha_nacimiento','telefono','direccion','email'];
    const csv = new Parser({ fields }).parse(results);
    res.header('Content-Type', 'text/csv');
    res.attachment('reporte_usuarios.csv');
    res.send(csv);
  });
});

/* =========================================================
   MÓDULO EÓLICOS (admin)
========================================================= */

// Lista
app.get('/eolicos', requireAuth, requireRole('administrador'), (req, res) => {
  const sql = `
    SELECT 
      e.id_eolico,
      e.codigo,
      e.activo,
      e.habilitado,
      e.usuario_id,
      e.fecha_creacion,
      u.nombres,
      u.primer_apellido,
      u.segundo_apellido,
      c.usuario AS login
    FROM eolicos e
    LEFT JOIN usuarios u ON u.id_usuario = e.usuario_id
    LEFT JOIN cuentas c  ON c.id_cuenta  = u.cuenta_id
    ORDER BY e.id_eolico ASC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
    res.json(rows || []);
  });
});

// Crear
app.post('/eolicos', requireAuth, requireRole('administrador'), [
  body('codigo').isString().trim().isLength({ min: 3, max: 20 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

  const codigo = String(req.body.codigo).trim().toUpperCase();
  db.query('INSERT INTO eolicos (codigo) VALUES (?)', [codigo], (err, r) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ mensaje: 'Ese código ya existe.' });
      return res.status(500).json({ mensaje: 'Error al crear eólico' });
    }
    res.status(201).json({ id_eolico: r.insertId, mensaje: 'Eólico creado' });
  });
});

// Asignar (cierra alquileres activos previos y abre uno nuevo)
app.put('/eolicos/:id/asignar', requireAuth, requireRole('administrador'), [
  param('id').isInt({ min: 1 }),
  body('usuario_id').isInt({ min: 1 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

  const eolico_id = Number(req.params.id);
  const usuario_id = Number(req.body.usuario_id);

  db.beginTransaction((txErr) => {
    if (txErr) return res.status(500).json({ mensaje: 'No se pudo iniciar transacción' });

    // 1) Finalizar alquiler activo de este eólico (si hay)
    db.query(
      "UPDATE alquileres SET estado='finalizado', fecha_fin=NOW() WHERE eolico_id=? AND estado='activo'",
      [eolico_id],
      (e1) => {
        if (e1) return db.rollback(() => res.status(500).json({ mensaje: 'Error cerrando alquiler previo del eólico' }));

        // 2) Finalizar alquiler activo del usuario (si tiene otro eólico)
        db.query(
          "UPDATE alquileres SET estado='finalizado', fecha_fin=NOW() WHERE usuario_id=? AND estado='activo'",
          [usuario_id],
          (e2) => {
            if (e2) return db.rollback(() => res.status(500).json({ mensaje: 'Error cerrando alquiler previo del usuario' }));

            // 3) Asignar eólico a usuario y habilitar
            db.query(
              'UPDATE eolicos SET usuario_id=?, activo=1, habilitado=1 WHERE id_eolico=?',
              [usuario_id, eolico_id],
              (e3) => {
                if (e3) return db.rollback(() => res.status(500).json({ mensaje: 'Error actualizando eólico' }));

                // 4) Abrir nuevo alquiler
                db.query(
                  "INSERT INTO alquileres (eolico_id, usuario_id, estado) VALUES (?, ?, 'activo')",
                  [eolico_id, usuario_id],
                  (e4) => {
                    if (e4) return db.rollback(() => res.status(500).json({ mensaje: 'Error creando alquiler' }));
                    db.commit((cErr) => {
                      if (cErr) return db.rollback(() => res.status(500).json({ mensaje: 'Error al confirmar' }));
                      res.json({ mensaje: 'Equipo asignado y alquiler abierto' });
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// Desasignar (cierra alquiler y limpia asignación)
app.put('/eolicos/:id/desasignar', requireAuth, requireRole('administrador'), [
  param('id').isInt({ min: 1 })
], (req, res) => {
  const eolico_id = Number(req.params.id);

  db.beginTransaction((txErr) => {
    if (txErr) return res.status(500).json({ mensaje: 'No se pudo iniciar transacción' });

    // 1) Apagar y quitar usuario
    db.query('UPDATE eolicos SET usuario_id=NULL, activo=0, habilitado=0 WHERE id_eolico=?', [eolico_id], (e1) => {
      if (e1) return db.rollback(() => res.status(500).json({ mensaje: 'Error al desasignar' }));

      // 2) Finalizar alquiler activo
      db.query(
        "UPDATE alquileres SET estado='finalizado', fecha_fin=NOW() WHERE eolico_id=? AND estado='activo'",
        [eolico_id],
        (e2) => {
          if (e2) return db.rollback(() => res.status(500).json({ mensaje: 'Error al cerrar alquiler' }));
          db.commit((cErr) => {
            if (cErr) return db.rollback(() => res.status(500).json({ mensaje: 'Error al confirmar' }));
            res.json({ mensaje: 'Equipo desasignado y alquiler finalizado' });
          });
        }
      );
    });
  });
});

// Toggle ACTIVO (on/off) – lo usan Usuarios.jsx y Eolicos.jsx
app.put('/eolicos/:id/toggle', requireAuth, requireRole('administrador'), [
  param('id').isInt({ min: 1 }),
  body('activo').isBoolean()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

  const eolico_id = Number(req.params.id);
  const activo = !!req.body.activo;

  db.query('SELECT usuario_id FROM eolicos WHERE id_eolico=?', [eolico_id], (e1, r1) => {
    if (e1) return res.status(500).json({ mensaje: 'Error en servidor' });
    if (!r1?.length) return res.status(404).json({ mensaje: 'Eólico no encontrado' });
    if (!r1[0].usuario_id) return res.status(400).json({ mensaje: 'Primero asigna este eólico a un usuario' });

    db.query('UPDATE eolicos SET activo=? WHERE id_eolico=?', [activo ? 1 : 0, eolico_id], (e2) => {
      if (e2) return res.status(500).json({ mensaje: 'No se pudo actualizar el estado' });
      res.json({ mensaje: `Eólico ${activo ? 'activado' : 'desactivado'}` });
    });
  });
});

// 🔵 Asignar por código (para usar desde Usuarios.jsx)
app.post('/eolicos/asignar-por-codigo',
  requireAuth,
  requireRole('administrador'),
  [
    body('codigo').isString().trim().isLength({ min: 3, max: 20 }),
    body('usuario_id').isInt({ min: 1 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errores: errors.array() });

    const codigo = String(req.body.codigo).trim().toUpperCase();
    const usuario_id = Number(req.body.usuario_id);

    db.query('SELECT id_eolico, usuario_id FROM eolicos WHERE codigo=? LIMIT 1', [codigo], (e0, r0) => {
      if (e0) return res.status(500).json({ mensaje: 'Error buscando eólico' });
      if (!r0?.length) return res.status(404).json({ mensaje: 'No existe un eólico con ese código.' });

      const eolico_id = r0[0].id_eolico;

      db.beginTransaction((txErr) => {
        if (txErr) return res.status(500).json({ mensaje: 'No se pudo iniciar transacción' });

        // 1) cerrar alquiler activo del eólico (si hay)
        db.query("UPDATE alquileres SET estado='finalizado', fecha_fin=NOW() WHERE eolico_id=? AND estado='activo'",
          [eolico_id], (e1) => {
            if (e1) return db.rollback(() => res.status(500).json({ mensaje: 'Error cerrando alquiler previo del eólico' }));

            // 2) cerrar alquiler activo del usuario (si tiene otro)
            db.query("UPDATE alquileres SET estado='finalizado', fecha_fin=NOW() WHERE usuario_id=? AND estado='activo'",
              [usuario_id], (e2) => {
                if (e2) return db.rollback(() => res.status(500).json({ mensaje: 'Error cerrando alquiler previo del usuario' }));

                // 3) asignar y habilitar
                db.query('UPDATE eolicos SET usuario_id=?, activo=1, habilitado=1 WHERE id_eolico=?',
                  [usuario_id, eolico_id], (e3) => {
                    if (e3) return db.rollback(() => res.status(500).json({ mensaje: 'Error actualizando eólico' }));

                    // 4) abrir nuevo alquiler
                    db.query("INSERT INTO alquileres (eolico_id, usuario_id, estado) VALUES (?, ?, 'activo')",
                      [eolico_id, usuario_id], (e4) => {
                        if (e4) return db.rollback(() => res.status(500).json({ mensaje: 'Error creando alquiler' }));
                        db.commit((cErr) => {
                          if (cErr) return db.rollback(() => res.status(500).json({ mensaje: 'Error al confirmar' }));
                          res.json({ mensaje: 'Eólico asignado por código y alquiler abierto' });
                        });
                      });
                  });
              });
          });
      });
    });
  }
);

/* =========================================================
   Iniciar servidor
========================================================= */
app.listen(PORT, () => {
  console.log(`🚀 Backend escuchando en http://localhost:${PORT}`);
});
