-- Create an admin user by updating an existing user's role
-- Replace 'your-email@example.com' with the email of the user you want to make admin

UPDATE profiles 
SET role = 'admin' 
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'georgewchead@gmail.com'
);

-- Verify the admin user was created
SELECT p.*, u.email 
FROM profiles p 
JOIN auth.users u ON p.id = u.id 
WHERE p.role = 'admin';
