const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Template = require('../models/Template.model');
const templateData = require('../data/templates');

dotenv.config();

// Kết nối MongoDB
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trello_clone?replicaSet=rs0';
        console.log(`Connecting to MongoDB at: ${mongoURI}`);

        const conn = await mongoose.connect(mongoURI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

const seedTemplates = async () => {
    try {
        await connectDB();

        console.log('Clearing existing templates...');
        await Template.deleteMany({});
        console.log('Templates cleared.');

        console.log('Seeding new templates...');

        const templatesToInsert = templateData.map(t => {
            return {
                name: t.name,
                description: t.description,
                category: t.category,
                color: t.color,
                tags: t.tags || [],
                popularity_score: t.popularity || 0,
                usage_count: t.usageCount || 0,
                is_popular: t.isPopular || false,
                lists: t.lists.map(l => ({
                    name: l.name,
                    position: l.position,
                    color: l.color,
                    example_cards: l.example_cards.map(c => ({
                        title: c.title,
                        description: c.description || '',
                        position: c.position
                    }))
                })),
                is_system: true,
                is_active: true
            };
        });

        await Template.insertMany(templatesToInsert);

        console.log(`Successfully seeded ${templatesToInsert.length} templates!`);
        process.exit(0);

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedTemplates();
