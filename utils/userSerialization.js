export const toPublicUser = (user) => {
  if (!user) {
    return user
  }

  const value = typeof user.toObject === 'function' ? user.toObject() : { ...user }
  delete value.password
  return value
}

export const toPublicUsers = (users) => users.map(toPublicUser)
