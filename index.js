const express = require('express'); // Framework para manejar rutas del backend.
const mysql = require('mysql2'); // Librería para conectarnos a MySQL desde Node.js.
const cors = require('cors'); // Permite que el frontend pueda comunicarse con el backend.
const bodyParser = require('body-parser'); // Permite que Node.js pueda leer datos en formato JSON.
require('dotenv').config(); // Manejo de variables de entorno.
const multer = require('multer'); // Para manejar subida de archivos.
const streamifier = require('streamifier'); // Para manejar buffers de archivos en streams
const cloudinary = require('cloudinary').v2; // Plataforma para manejar imágenes en la nube

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuración de conexión a MySQL con variables de entorno
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
  console.log('✅ Conectado a MySQL correctamente en la nube...');
});

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuración de `multer` para recibir imágenes como buffer en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('✅ Servidor funcionando correctamente...');
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

// Subir imagen a Cloudinary (Función reutilizable)
const subirImagenACloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'usuarios' }, // Carpeta en Cloudinary
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Agregar un usuario con imagen (si la imagen existe)
app.post('/usuarios', upload.single('foto'), async (req, res) => {
  try {
    const { nombre, email, telefono } = req.body;
    let fotoUrl = null;

    // Si hay una imagen, la subimos a Cloudinary
    if (req.file) {
      fotoUrl = await subirImagenACloudinary(req.file.buffer);
    }

    // Insertar usuario en MySQL con la URL de la imagen (si existe)
    db.query(
      'INSERT INTO usuarios (nombre, email, telefono, foto) VALUES (?, ?, ?, ?)',
      [nombre, email, telefono, fotoUrl],
      (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          mensaje: '✅ Usuario agregado',
          id: result.insertId,
          foto: fotoUrl,
        });
      }
    );
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar usuario
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
        res.json({ mensaje: '✅ Usuario actualizado' });
      }
    }
  );
});

// Eliminar usuario
app.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM usuarios WHERE id=?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ mensaje: '✅ Usuario eliminado' });
    }
  });
});

// Servidor en el puerto de Heroku o 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
