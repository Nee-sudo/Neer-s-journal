const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    progress: { type: Number, min: 0, max: 100, required: true },
    progressText: { type: String, required: true }
});

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    targetDate: { type: String, required: true },
    progress: { type: Number, min: 0, max: 100, required: true },
    progressText: { type: String, required: true }
});

const languageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    proficiency: { type: String, required: true },
    progress: { type: Number, min: 0, max: 100, required: true },
    flagUrl: { type: String, required: true },
    isLearning: { type: Boolean, default: false }
});

const studyTopicSchema = new mongoose.Schema({
    topic: { type: String, required: true },
    status: { type: String, required: true }
});

const deadlineSchema = new mongoose.Schema({
    task: { type: String, required: true },
    date: { type: String, required: true }
});

const projectCardSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    completedDate: { type: String },
    techTags: [{ type: String }],
    githubUrl: { type: String },
    liveUrl: { type: String }
});

const loginContentSchema = new mongoose.Schema({
    learning: {
        title: { type: String, default: "What I'm Learning" },
        skills: [skillSchema],
        currentlyStudying: { type: String, default: "Currently Focusing on **All Three Skills**" }
    },
    working: {
        title: { type: String, default: "What I'm Working On & Side Projects" },
        projects: [projectSchema],
        productivityTitle: { type: String, default: "90-Day Productivity Challenge (Sep 2025)" }
    },
    languages: {
        title: { type: String, default: "Languages I Speak" },
        languages: [languageSchema]
    },
    currentActivity: {
        title: { type: String, default: "Currently What I'm Doing" },
        activity: { type: String, default: "I'm primarily focused on **optimizing backend performance** for high-traffic applications, diving deep into database indexing, query optimization, and microservices architecture. Continuous learning is my mantra!" }
    },
    studyDeadlines: {
        title: { type: String, default: "What I'm Studying & Deadlines" },
        studyTopics: [studyTopicSchema],
        deadlines: [deadlineSchema]
    },
    projects: {
        title: { type: String, default: "My Projects" },
        projectCards: [projectCardSchema]
    },
    loginSection: {
        title: { type: String, default: "Login to Know More About Me" },
        description: { type: String, default: "Unlock a deeper insight into my professional journey, detailed project breakdowns, and exclusive content. Your unique access awaits!" }
    }
}, { timestamps: true });

module.exports = mongoose.model('LoginContent', loginContentSchema);
