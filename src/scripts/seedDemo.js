const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("../models/User.model");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");
const List = require("../models/List.model");
const Card = require("../models/Card.model");

dotenv.config();

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "Demo123!";

const DEMO_USERS = [
  { key: "owner", email: "owner@demo.local", full_name: "Demo Owner" },
  { key: "admin", email: "admin@demo.local", full_name: "Demo Admin" },
  { key: "member", email: "member@demo.local", full_name: "Demo Member" },
  { key: "viewer", email: "viewer@demo.local", full_name: "Demo Viewer" },
];

const connectDB = async () => {
  const mongoURI =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/trello_clone?replicaSet=rs0";
  console.log(`Connecting to MongoDB at: ${mongoURI}`);
  const conn = await mongoose.connect(mongoURI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

const upsertDemoUser = async ({ email, full_name }) => {
  let user = await User.findOne({ email }).select("+password");
  if (!user) {
    user = await User.create({
      email,
      full_name,
      password: DEMO_PASSWORD,
      providers: ["password"],
    });
    return user;
  }

  user.full_name = full_name;
  user.password = DEMO_PASSWORD;
  if (!user.providers.includes("password")) {
    user.providers = [...user.providers, "password"];
  }
  await user.save();
  return user;
};

const seedDemo = async () => {
  try {
    await connectDB();

    console.log("Upserting demo users...");
    const users = {};
    for (const demoUser of DEMO_USERS) {
      users[demoUser.key] = await upsertDemoUser(demoUser);
    }

    const workspaceName = "Demo Role Matrix";
    let workspace = await Workspace.findOne({
      name: workspaceName,
      owner: users.owner._id,
      deleted_at: null,
    });

    const memberDocs = [
      { user: users.owner._id, role: "admin" },
      { user: users.admin._id, role: "admin" },
      { user: users.member._id, role: "member" },
      { user: users.viewer._id, role: "viewer" },
    ];

    if (!workspace) {
      workspace = await Workspace.create({
        name: workspaceName,
        description:
          "Seeded workspace for owner / admin / member / viewer validation",
        color: "bg-blue-500",
        visibility: "private",
        owner: users.owner._id,
        members: memberDocs,
        permissions: {
          canCreateBoard: "admin_member",
          canInviteMember: "admin_member",
        },
      });
      console.log(`Created workspace: ${workspace._id}`);
    } else {
      workspace.members = memberDocs;
      workspace.visibility = "private";
      await workspace.save();
      console.log(`Updated workspace: ${workspace._id}`);
    }

    const boardTitle = "Demo Board";
    let board = await Board.findOne({
      title: boardTitle,
      workspace: workspace._id,
      deleted_at: null,
    });

    if (!board) {
      board = await Board.create({
        title: boardTitle,
        description: "Seeded board for role and DnD checks",
        color: "bg-emerald-500",
        visibility: "workspace",
        workspace: workspace._id,
        owner: users.owner._id,
        members: memberDocs,
      });
      console.log(`Created board: ${board._id}`);
    } else {
      board.members = memberDocs;
      board.visibility = "workspace";
      board.owner = users.owner._id;
      await board.save();
      console.log(`Updated board: ${board._id}`);
    }

    const listTitles = ["To Do", "Doing", "Done"];
    const lists = [];
    for (const [index, title] of listTitles.entries()) {
      let list = await List.findOne({
        title,
        board: board._id,
        deleted_at: null,
      });
      if (!list) {
        list = await List.create({
          title,
          board: board._id,
          workspace: workspace._id,
          pos: 65536 * (index + 1),
        });
      }
      lists.push(list);
    }

    const existingCards = await Card.countDocuments({
      board: board._id,
      deleted_at: null,
    });
    if (existingCards === 0) {
      await Card.create([
        {
          title: "Welcome card",
          description: "Move me into an empty list to verify DnD.",
          list: lists[0]._id,
          board: board._id,
          workspace: workspace._id,
          pos: 65536,
          creator: users.owner._id,
          members: [users.member._id],
        },
        {
          title: "Viewer should not edit",
          description: "Use viewer@demo.local to confirm read-only UI.",
          list: lists[0]._id,
          board: board._id,
          workspace: workspace._id,
          pos: 131072,
          creator: users.owner._id,
        },
      ]);
      console.log("Created sample cards");
    }

    console.log("\nDemo accounts ready (password for all):");
    console.log(`  ${DEMO_PASSWORD}`);
    for (const demoUser of DEMO_USERS) {
      console.log(`  ${demoUser.email} (${demoUser.key})`);
    }
    console.log(`\nWorkspace: ${workspace._id}`);
    console.log(`Board:     ${board._id}`);
    console.log(`Open FE board: /board/${board._id}`);

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedDemo();
