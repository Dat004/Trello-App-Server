/**
 * Seed a large board for Phase 4 perf measurement (before deciding to virtualize).
 *
 * Usage:
 *   npm run seed:large-board
 *   LARGE_BOARD_LISTS=8 LARGE_BOARD_CARDS_PER_LIST=40 npm run seed:large-board
 *
 * Requires demo owner from seed:demo (owner@demo.local).
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/User.model");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const List = require("../models/List.model");
const Card = require("../models/Card.model");

dotenv.config();

const LIST_COUNT = Number(process.env.LARGE_BOARD_LISTS) || 6;
const CARDS_PER_LIST = Number(process.env.LARGE_BOARD_CARDS_PER_LIST) || 50;
const BOARD_TITLE = process.env.LARGE_BOARD_TITLE || "Large Perf Board";

const connectDB = async () => {
  const mongoURI =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/trello_clone?replicaSet=rs0";
  console.log(`Connecting to MongoDB at: ${mongoURI}`);
  const conn = await mongoose.connect(mongoURI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

const seedLargeBoard = async () => {
  try {
    await connectDB();

    const owner = await User.findOne({ email: "owner@demo.local" });
    if (!owner) {
      console.error(
        "Demo owner not found. Run `npm run seed:demo` first (owner@demo.local).",
      );
      process.exit(1);
    }

    let workspace = await Workspace.findOne({
      name: "Demo Role Matrix",
      owner: owner._id,
      deleted_at: null,
    });

    if (!workspace) {
      workspace = await Workspace.create({
        name: "Demo Role Matrix",
        description: "Created by seed:large-board (run seed:demo for full roles)",
        color: "bg-blue-500",
        visibility: "private",
        owner: owner._id,
        members: [{ user: owner._id, role: "admin" }],
      });
    }

    let board = await Board.findOne({
      title: BOARD_TITLE,
      workspace: workspace._id,
      deleted_at: null,
    });

    if (board) {
      await Card.deleteMany({ board: board._id });
      await List.deleteMany({ board: board._id });
      console.log(`Cleared existing lists/cards on "${BOARD_TITLE}"`);
    } else {
      board = await Board.create({
        title: BOARD_TITLE,
        description: `Perf fixture: ${LIST_COUNT} lists × ${CARDS_PER_LIST} cards`,
        color: "bg-violet-500",
        visibility: "workspace",
        workspace: workspace._id,
        owner: owner._id,
        members: [{ user: owner._id, role: "admin" }],
      });
      console.log(`Created board: ${board._id}`);
    }

    const listIds = [];
    for (let i = 0; i < LIST_COUNT; i += 1) {
      const list = await List.create({
        title: `List ${i + 1}`,
        board: board._id,
        workspace: workspace._id,
        pos: 65536 * (i + 1),
      });
      listIds.push(list._id);

      const cards = [];
      for (let j = 0; j < CARDS_PER_LIST; j += 1) {
        cards.push({
          title: `Card ${i + 1}-${j + 1}`,
          description: j % 5 === 0 ? `Perf card description ${j + 1}` : "",
          list: list._id,
          board: board._id,
          workspace: workspace._id,
          pos: 65536 * (j + 1),
          creator: owner._id,
        });
      }
      await Card.insertMany(cards);
    }

    const totalCards = LIST_COUNT * CARDS_PER_LIST;
    console.log("\nLarge board ready:");
    console.log(`  Title:  ${BOARD_TITLE}`);
    console.log(`  Lists:  ${LIST_COUNT}`);
    console.log(`  Cards:  ${totalCards}`);
    console.log(`  Board:  ${board._id}`);
    console.log(`  Open:   /board/${board._id}`);
    console.log(
      "\nMeasure: board open time, scroll FPS, DnD lag. Virtualize only if budgets fail.",
    );

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedLargeBoard();
