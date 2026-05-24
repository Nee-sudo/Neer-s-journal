// models/adminData.js
const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: String,
  desc: String,
  progress: Number,
  icon: String
});

const projectSchema = new mongoose.Schema({
  title: String,
  desc: String,
  progress: Number,
  date: Date,
  icon: String
});

const studySchema = new mongoose.Schema({
  topic: String,
  status: String
});

const deadlineSchema = new mongoose.Schema({
  task: String,
  date: Date
});

const activitySchema = new mongoose.Schema({
  text: String
});

module.exports = {
  Skill: mongoose.model('Skill', skillSchema),
  Project: mongoose.model('Project', projectSchema),
  Study: mongoose.model('Study', studySchema),
  Deadline: mongoose.model('Deadline', deadlineSchema),
  Activity: mongoose.model('Activity', activitySchema)
};