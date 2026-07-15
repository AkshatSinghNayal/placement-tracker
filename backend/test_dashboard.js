import './src/config/env.js'
import { connectDB, closeDB } from './src/config/db.js'
import User from './src/models/User.js'
import DsaQuestion from './src/models/DsaQuestion.js'
import ResumeKeyword from './src/models/ResumeKeyword.js'
import UserCompany from './src/models/UserCompany.js'
import ChecklistItem from './src/models/ChecklistItem.js'
import ActivityLog from './src/models/ActivityLog.js'
import mongoose from 'mongoose'

async function run() {
  await connectDB()

  // Get the first user or create a temp one to test
  let user = await User.findOne()
  if (!user) {
    user = await User.create({
      email: 'temp-test@offerforge.com',
      full_name: 'Temp Test User',
      is_active: true
    })
    console.log('Created temporary test user')
  }
  const userId = user._id
  console.log(`Using user ID: ${userId} (${user.email})`)

  console.log('\n--- Checking Collections ---')
  const collections = await mongoose.connection.db.listCollections().toArray()
  console.log('Collections in database:', collections.map(c => c.name))

  try {
    console.log('\n--- Running DSA Count Queries ---')
    const [dsaTotal, dsaSolved] = await Promise.all([
      DsaQuestion.countDocuments({ user_id: userId }),
      DsaQuestion.countDocuments({ user_id: userId, status: 'Solved' }),
    ])
    console.log(`DSA Solved: ${dsaSolved} / ${dsaTotal}`)

    console.log('\n--- Running Resume Keyword Aggregation ---')
    const [kwTotal, kwPresent] = await Promise.all([
      ResumeKeyword.aggregate([
        { $match: {} },
        { $lookup: { from: 'resumes', localField: 'resume_id', foreignField: '_id', as: 'r' } },
        { $unwind: '$r' },
        { $match: { 'r.user_id': userId } },
        { $count: 'n' },
      ]),
      ResumeKeyword.aggregate([
        { $match: { is_present: true } },
        { $lookup: { from: 'resumes', localField: 'resume_id', foreignField: '_id', as: 'r' } },
        { $unwind: '$r' },
        { $match: { 'r.user_id': userId } },
        { $count: 'n' },
      ]),
    ])
    console.log('Resume Keyword Aggregation Succeeded:', { kwTotal, kwPresent })

    console.log('\n--- Running Checklist Items count ---')
    const ucRows = await UserCompany.find({ user_id: userId }).select('_id')
    const ucIds = ucRows.map((u) => u._id)
    console.log(`UserCompany IDs: ${ucIds.length}`)

    console.log('\n--- Running buildCharts Aggregations ---')
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const solvedAgg = await DsaQuestion.aggregate([
      {
        $match: {
          user_id: userId,
          completed_at: { $ne: null, $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completed_at' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    console.log('solvedAgg Succeeded:', solvedAgg.length)

    const topicAgg = await DsaQuestion.aggregate([
      { $match: { user_id: userId } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          total: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'dsatags', localField: '_id', foreignField: '_id', as: 'tag' } },
      { $unwind: '$tag' },
      { $sort: { 'tag.name': 1 } },
    ])
    console.log('topicAgg Succeeded:', topicAgg.length)

    console.log('\n--- Running Streak Aggregation ---')
    const rows = await ActivityLog.aggregate([
      { $match: { user_id: userId } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
    ])
    console.log('Streak Aggregation Succeeded:', rows.length)

  } catch (err) {
    console.error('\nERROR DETECTED during query execution:')
    console.error(err)
  }

  await closeDB()
}

run().catch(console.error)
