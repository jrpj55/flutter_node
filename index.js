// Importa el framework Express para manejar las rutas y peticiones del backend.
const express = require('express'); // Framework para manejar las rutas del backend.

// Importa la librería mysql2 para conectarse a MySQL desde Node.js.
const mysql = require('mysql2'); // Librería para conectarnos a MySQL desde Node.js.

// Importa cors para permitir que el frontend se comunique con el backend sin problemas de seguridad (CORS).
const cors = require('cors'); // Permite que el frontend pueda comunicarse con el backend sin problemas de seguridad.

// Importa body-parser para que Node.js pueda leer y parsear datos en formato JSON enviados desde el frontend.
const bodyParser = require('body-parser'); // Permite que Node.js pueda leer datos en formato JSON enviados desde el frontend.

// Carga las variables de entorno definidas en un archivo .env para no exponer datos sensibles en el código.
require('dotenv').config(); // Nos permite manejar variables de entorno en un archivo separado.

// Importa la versión v2 de Cloudinary, que se usa para subir y gestionar imágenes en la nube.
const cloudinary = require('cloudinary').v2;

// Importa multer, un middleware para manejar multipart/form-data, necesario para la subida de archivos.
const multer = require('multer');

// Crea una instancia de la aplicación Express.
const app = express();

// Configura la aplicación para usar cors y permitir solicitudes de otros orígenes.
app.use(cors());

// Configura la aplicación para interpretar el cuerpo de las solicitudes en formato JSON.
app.use(bodyParser.json());

// Configura Cloudinary con las credenciales almacenadas en las variables de entorno.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Nombre de la nube de Cloudinary.
  api_key: process.env.CLOUDINARY_API_KEY, // API Key para autenticar la cuenta.
  api_secret: process.env.CLOUDINARY_API_SECRET, // API Secret para autenticar la cuenta.
});

// Configura multer para almacenar archivos de forma temporal en la carpeta 'uploads/'.
const upload = multer({ dest: 'uploads/' });

// Configuración de la base de datos MySQL usando variables de entorno para los datos de conexión.
const db = mysql.createConnection({
  host: process.env.DB_HOST, // Dirección del servidor MySQL.
  user: process.env.DB_USER, // Usuario de la base de datos.
  password: process.env.DB_PASSWORD, // Contraseña del usuario.
  database: process.env.DB_NAME, // Nombre de la base de datos.
});

// Conecta a la base de datos MySQL.
db.connect((err) => {
  if (err) {
    // Si ocurre un error al conectar, se imprime el error en consola.
    console.error('❌ Error conectando a MySQL:', err);
    return;
  }
  // Si la conexión es exitosa, se muestra un mensaje de confirmación en consola.
  console.log('✅ Conectado a MySQL correctamente...');
});

// Ruta de prueba para verificar que el servidor esté funcionando.
app.get('/', (req, res) => {
  res.send('Servidor funcionando...'); // Envía un mensaje simple de confirmación.
});

// Ruta para obtener todos los usuarios desde la base de datos.
app.get('/usuarios', (req, res) => {
  // Realiza una consulta SQL para seleccionar todos los registros de la tabla 'usuarios'.
  db.query('SELECT * FROM usuarios', (err, results) => {
    if (err) {
      // En caso de error, se responde con un código 500 y el mensaje de error en formato JSON.
      res.status(500).json({ error: err.message });
    } else {
      // Si la consulta es exitosa, se envían los resultados en formato JSON.
      res.json(results);
    }
  });
});

// Ruta para agregar un nuevo usuario, incluyendo la subida de una foto.
app.post('/usuarios', upload.single('foto'), (req, res) => {
  // Extrae los datos enviados en el cuerpo de la solicitud.
  const { nombre, email, telefono } = req.body;
  // Inicializa la variable fotoUrl en null; se actualizará si se sube una imagen.
  let fotoUrl = null;

  // Verifica si se ha enviado un archivo (campo 'foto').
  if (req.file) {
    // Sube el archivo a Cloudinary, especificando la carpeta 'usuarios' para organizar las imágenes.
    cloudinary.uploader.upload(
      req.file.path, // Ruta del archivo temporal subido por multer.
      { folder: 'usuarios' }, // Opciones: especifica la carpeta en Cloudinary.
      (error, result) => {
        // Callback que se ejecuta cuando finaliza la subida.
        if (error) {
          // Si ocurre un error durante la subida, se imprime en consola y se responde con un error 500.
          console.error('Error al subir la imagen:', error);
          return res.status(500).json({ error: 'Error al subir la imagen' });
        }

        // Obtiene la URL segura de la imagen subida desde Cloudinary.
        fotoUrl = result.secure_url;

        // Inserta el nuevo usuario en la base de datos, incluyendo la URL de la imagen.
        db.query(
          'INSERT INTO usuarios (nombre, email, telefono, foto) VALUES (?, ?, ?, ?)',
          [nombre, email, telefono, fotoUrl],
          (err, result) => {
            if (err) {
              // En caso de error al insertar en la base de datos, se responde con un error 500.
              res.status(500).json({ error: err.message });
            } else {
              // Si la inserción es exitosa, se responde con un mensaje y el ID del nuevo usuario.
              res.json({ mensaje: 'Usuario agregado', id: result.insertId });
            }
          }
        );
      }
    );
  } else {
    // Si no se envía foto, inserta el usuario sin la URL de la foto (se mantiene null).
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

/// Ruta para actualizar un usuario existente.
app.put('/usuarios/:id', upload.single('foto'), (req, res) => {
  // Extrae los datos a actualizar del cuerpo de la solicitud.
  const { nombre, email, telefono } = req.body;
  // Extrae el ID del usuario a actualizar de los parámetros de la URL.
  const { id } = req.params;

  // Verifica si se ha enviado un archivo en el campo 'foto'.
  if (req.file) {
    // Si se envió una nueva foto, se sube el archivo a Cloudinary.
    cloudinary.uploader.upload(
      req.file.path, // Ruta del archivo temporal subido por multer.
      { folder: 'usuarios' }, // Especifica la carpeta en Cloudinary donde se guardará la imagen.
      (error, result) => {
        // Callback que se ejecuta cuando finaliza la subida.
        if (error) {
          // Si ocurre un error durante la subida, se imprime en consola y se responde con un error 500.
          console.error('Error al subir la imagen:', error);
          return res.status(500).json({ error: 'Error al subir la imagen' });
        }
        // Se obtiene la URL segura de la imagen subida.
        const fotoUrl = result.secure_url;

        // Actualiza todos los campos del usuario, incluyendo la nueva URL de la foto.
        // Los parámetros se pasan en el orden: [nombre, email, telefono, fotoUrl, id]
        db.query(
          'UPDATE usuarios SET nombre=?, email=?, telefono=?, foto=? WHERE id=?',
          [nombre, email, telefono, fotoUrl, id],
          (err) => {
            if (err) {
              // En caso de error al actualizar, se responde con un error 500.
              res.status(500).json({ error: err.message });
            } else {
              // Si la actualización es exitosa, se envía un mensaje de confirmación.
              res.json({ mensaje: 'Usuario actualizado' });
            }
          }
        );
      }
    );
  } else {
    // Si no se envía una nueva foto, se actualizan solo los campos de texto.
    // Esto evita modificar el campo "foto" y deja la imagen existente intacta.
    db.query(
      'UPDATE usuarios SET nombre=?, email=?, telefono=? WHERE id=?',
      [nombre, email, telefono, id],
      (err) => {
        if (err) {
          // En caso de error en la actualización, se responde con un error 500.
          res.status(500).json({ error: err.message });
        } else {
          // Si la actualización es exitosa, se envía un mensaje de confirmación.
          res.json({ mensaje: 'Usuario actualizado sin modificar la foto' });
        }
      }
    );
  }
});

// Ruta para eliminar un usuario.
app.delete('/usuarios/:id', (req, res) => {
  // Extrae el ID del usuario a eliminar de los parámetros de la URL.
  const { id } = req.params;
  // Ejecuta una consulta SQL para eliminar el usuario con el ID dado.
  db.query('DELETE FROM usuarios WHERE id=?', [id], (err) => {
    if (err) {
      // En caso de error, responde con un código 500 y el mensaje de error.
      res.status(500).json({ error: err.message });
    } else {
      // Si la eliminación es exitosa, envía un mensaje de confirmación.
      res.json({ mensaje: 'Usuario eliminado' });
    }
  });
});

// Define el puerto en el que se levantará el servidor, usando el puerto definido en las variables de entorno o 3000 por defecto.
const PORT = process.env.PORT || 3000;

// Inicia el servidor y escucha las peticiones en el puerto definido.
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

//Resumen de lo que hace este código:
//Configuración del servidor y middleware:
//Se configuran Express, CORS, body-parser y las variables de entorno. Además, se configura Cloudinary y multer para el manejo de imágenes.

//Conexión a MySQL:
//Se establece una conexión a la base de datos usando los parámetros definidos en las variables de entorno y se verifica la conexión.

//Rutas del API:
//Se definen rutas para probar el servidor, obtener, agregar, actualizar y eliminar usuarios.
//La ruta para agregar usuarios maneja la subida de imágenes usando multer y Cloudinary, insertando en la base de datos la URL de la imagen si se envía.

//Inicio del servidor:
//El servidor se inicia en el puerto definido (por Heroku o 3000 por defecto).
