const mongoose = require('mongoose');

// The "support" role was renamed to "superadmin" (shown as "Super Admin").
// Runs at startup and is a no-op once done: renames stored roles and rebuilds
// the index that allows only one Super Admin.
const migrateLegacyRoles = async () => {
  const users = mongoose.connection.collection('users');
  const { modifiedCount } = await users.updateMany({ role: 'support' }, { $set: { role: 'superadmin' } });

  // The unique index used to target role "support"; replace it so the
  // one-Super-Admin rule keeps working.
  const indexes = await users.indexes().catch(() => []);
  for (const index of indexes) {
    if (index.partialFilterExpression?.role === 'support') await users.dropIndex(index.name);
  }
  await require('../models/auth/User').createIndexes();

  if (modifiedCount) console.log(`[migrateLegacyRoles] renamed ${modifiedCount} "support" account(s) to "superadmin"`);
  return modifiedCount;
};

module.exports = migrateLegacyRoles;
