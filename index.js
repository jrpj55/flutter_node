const express = require('express'); // Framework para manejar las rutas del backend.
const mysql = require('mysql2'); // Librería para conectarnos a MySQL desde Node.js.
const cors = require('cors'); // Permite que el frontend pueda comunicarse con el backend sin problemas de seguridad.
const bodyParser = require('body-parser'); // Permite que Node.js pueda leer datos en formato JSON enviados desde el frontend.
require('dotenv').config(); // Nos permite manejar variables de entorno en un archivo separado.

const cloudinary = require('cloudinary').v2;
const multer = require('multer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ dest: 'uploads/' });

// Configuración de la base de datos MySQL usando variables de entorno
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Conectar a MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ Error conectando a MySQL:', err);
    return;
  }
  console.log('✅ Conectado a MySQL correctamente...');
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando...');
});

// Obtener todos los usuarios
app.get('/usuarios', (req, res) => {
  db.query('SELECT * FROM usuarios', (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(results);
    }
  });
});

// Agregar un usuario (ahora con foto)
app.post('/usuarios', upload.single('foto'), (req, res) => {
  const { nombre, email, telefono } = req.body;
  let fotoUrl = null;

  // Si se ha enviado un archivo, subirlo a Cloudinary
  if (req.file) {
    cloudinary.uploader.upload(
      req.file.path,
      { folder: 'usuarios' },
      (error, result) => {
        if (error) {
          console.error('Error al subir la imagen:', error);
          return res.status(500).json({ error: 'Error al subir la imagen' });
        }

        // La URL segura de la imagen subida
        fotoUrl = result.secure_url;

        // Insertar el usuario en la base de datos, incluyendo la URL de la foto
        db.query(
          'INSERT INTO usuarios (nombre, email, telefono, foto) VALUES (?, ?, ?, ?)',
          [nombre, email, telefono, fotoUrl],
          (err, result) => {
            if (err) {
              res.status(500).json({ error: err.message });
            } else {
              res.json({ mensaje: 'Usuario agregado', id: result.insertId });
            }
          }
        );
      }
    );
  } else {
    // Si no se envía foto, se inserta sin ella
    db.query(
      'INSERT INTO usuarios (nombre, email, telefono, foto) VALUES (?, ?, ?, ?)',
      [nombre, email, telefono, fotoUrl],
      (err, result) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({
            mensaje: 'Usuario agregado sin foto',
            id: result.insertId,
          });
        }
      }
    );
  }
});

// Actualizar un usuario
app.put('/usuarios/:id', (req, res) => {
  const { nombre, email, telefono } = req.body;
  const { id } = req.params;
  db.query(
    'UPDATE usuarios SET nombre=?, email=?, telefono=? WHERE id=?',
    [nombre, email, telefono, id],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ mensaje: 'Usuario actualizado' });
      }
    }
  );
});

// Eliminar un usuario
app.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM usuarios WHERE id=?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ mensaje: 'Usuario eliminado' });
    }
  });
});

// Levantar servidor en el puerto de Heroku o 3000 por defecto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
