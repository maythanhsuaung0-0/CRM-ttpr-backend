// logic for fetching and posting
import User from '../models/User.js'
import { catchAsync } from '../utils/commonFunctions.js'
import * as argon2 from 'argon2'
import { toPublicUser, toPublicUsers } from '../utils/userSerialization.js'

export const createUsers = catchAsync(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase()
  const id = String(req.body.id ?? '').trim()
  const existingUser = await User.findOne({ $or: [{ email }, { id }] })

  if (!existingUser) {
    const pwd = await argon2.hash(req.body.password)
    const data = { ...req.body, email, id, password: pwd }
    const user = await User.create(data)
    res.status(200).json(toPublicUser(user))
  }
  else {
    res.status(409).json({ message: 'An account with that email or institutional ID already exists' })
  }
}
)

export const matrix = catchAsync(async (req, res, next) => {
  console.log('matrix')
  const studentCount = await User.countDocuments({ role: 'student', locked: false });
  console.log(studentCount,'studentCount')
  const staffCount = await User.countDocuments({ role: { $in: ['admin', 'staff'] }, locked: false, verified: true });
  const pendingStaffCount = await User.countDocuments({ role: { $in: ['admin', 'staff'] }, verified: false, locked: false });
  res.status(200).json({ studentCount, staffCount, pendingStaffCount })
})

export const actionPendingStaff = catchAsync(async (req, res, next) => {
  const { id } = req.params
  console.log(id,'id')
  const { action } = req.body // action should be either 'approve' or 'reject'
  const check = await User.find({ _id: id })
  console.log(check,'check')
  if(check.length!==0){
  if (action === 'approve') {
    const user = await User.updateOne({ _id: id }, { $set: { verified: true } })
   console.log(user,'user')
      res.status(200).json({message:"Staff approved successfully"})
  }
    else if (action === 'reject') {
      const user = await User.deleteOne({ _id: id })
      res.status(200).json({message:"Staff rejected and deleted successfully"})
    }
  }
  else{
    res.status(404).json({message:"No user found with the given id"})
  }
})
export const getRegisteredStaffs = catchAsync(async (req, res, next) => {
  const user = await User.find({ role: { $in: ['admin', 'staff'] }, locked: false })
  if(user.length===0){
    return res.status(200).json([])
  }
  res.status(200).json(toPublicUsers(user))
})

export const getStudents = catchAsync(async (req, res, next) => {
  const user = await User.find({ role: 'student', locked: false })
  res.status(200).json(toPublicUsers(user))
})
export const getVerifiedStaffs = catchAsync(async (req, res, next) => {
  const user = await User.find({ role: { $in: ['admin', 'staff'] }, verified: true, locked: false })
  res.status(200).json(toPublicUsers(user))
})
export const getPendingStaffs = catchAsync(async (req, res, next) => {
  let { page, pageSize } = req.query;

  // If "page" and "pageSize" are not sent we will default them to 1 and 50.
  page = parseInt(page, 10) || 1;
  pageSize = parseInt(pageSize, 10) || 50;
  console.log(page, pageSize, 'pagination params');
  const users = await User.aggregate([
    { $match: { role: { $in: ['admin', 'staff'] }, verified: false, locked: false } },
    { $project: { password: 0 } },
    {
      $facet: {
        metadata: [{ $count: 'totalCount' }],
        data: [{
          $sort: { createdAt: -1 }
        }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
      }
    }
  ]);
  console.log(users, 'paginated users');
  if (users.length === 0 || users[0].data.length === 0) {
    return res.status(200).json({
      success: true,
      metadata: { totalCount: 0, page, pageSize },
      pendingStaffs: [],
    });
  }
  return res.status(200).json({
    success: true,
    metadata: { totalCount: users[0].metadata[0].totalCount, page, pageSize },
    pendingStaffs: toPublicUsers(users[0].data),
  });
})
export const getLockedUsers = catchAsync(async (req, res, next) => {
  const user = await User.find({ locked: true })
  res.status(200).json(toPublicUsers(user))
})

export const getUsers = catchAsync(async (req, res, next) => {
  const user = await User.find(req.query?.role ? req.query : {})
  res.status(200).json(toPublicUsers(user))
}
)
export const getCurrentUser= catchAsync(async (req, res, next) => {
  // req.body should come as {id:'...'}
  const { userId } = req.UserData
  const user = await User.find({ _id: userId })
  res.status(200).json(toPublicUsers(user))
})
//get one user with id
export const getOneUser= catchAsync(async (req, res, next) => {
  // req.body should come as {id:'...'}
  const { id } = req.params 
  console.log(id,'id')
  const user = await User.find({ _id: id })
  if(user.length===0){
    return res.status(404).json({message:"No user found with the given id"})
  }
  res.status(200).json(toPublicUsers(user))
}
)
export const updateUser = catchAsync(async (req, res, next) => {
  const { _id, data } = req.body
  const safeData = { ...data }
  delete safeData.password
  if (safeData.email) {
    safeData.email = safeData.email.trim().toLowerCase()
  }
  if (safeData.id) {
    safeData.id = String(safeData.id).trim()
  }
  await User.updateOne({ _id: _id }, { $set: safeData }, { runValidators: true })
  const check = await User.find({ _id: _id })
  res.status(200).json(toPublicUsers(check))
}
)
export const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.body.id)
  if(!user){
    return res.status(404).json({message:"No user found with the given id"})
  }

  res.status(200).json(toPublicUser(user))
 
})

