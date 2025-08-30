export const authJwtModuleOptions = {
  secret: process.env['JWT_SECRET'],
  signOptions: { expiresIn: '24h' },
};
