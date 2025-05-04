// Backend

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const User = require('./models/User');
const Photo = require('./models/Photo');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
  

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/signup', async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.send(user);
});

app.post('/login', async (req, res) => {
  const user = await User.findOne(req.body);
  if (!user) return res.status(401).send('Invalid credentials');
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.send({ token });
});

app.post('/upload', upload.single('image'), async (req, res) => {
  // Check if file is present
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  // Upload to Cloudinary using buffer
  cloudinary.uploader.upload_stream(
    { resource_type: 'auto' }, // Automatically detect the resource type (image, video, etc.)
    async (error, result) => {
      if (error) {
        return res.status(500).send('Error uploading to Cloudinary');
      }

      // Save photo details in the database
      const photo = new Photo({
        url: result.secure_url,  // Cloudinary URL
        user: req.body.userId,  // userId passed from frontend
        likes: 0
      });

      await photo.save();
      res.send(photo);  // Send the photo back as a response
    }
  ).end(req.file.buffer); // Use the buffer from multer, not the stream
});



app.post('/like', async (req, res) => {
  const { photoId, userId } = req.body;

  const photo = await Photo.findById(photoId);
  if (!photo) return res.status(404).send('Photo not found');

  const userIndex = photo.likedBy.indexOf(userId);

  if (userIndex === -1) {
    // User has not liked it yet
    photo.likes += 1;
    photo.likedBy.push(userId);
  } else {
    // User already liked it, so unlike
    photo.likes -= 1;
    photo.likedBy.splice(userIndex, 1);
  }

  await photo.save();
  const updatedPhoto = await Photo.findById(photoId).populate('user');
  res.send(updatedPhoto);
});


app.get('/photos', async (req, res) => {
  const photos = await Photo.find().populate('user');
  res.send(photos);
});

app.get('/top-photos', async (req, res) => {
  const topPhotos = await Photo.find().sort({ likes: -1 }).limit(5).populate('user');
  res.send(topPhotos);
});

app.listen(5000, () => console.log('Backend running on port 5000'));