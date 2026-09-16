const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const originalSchema = fs.readFileSync(schemaPath, 'utf8');

const tempOutputDir = path.join(__dirname, '..', 'node_modules', '.prisma', 'temp_client');
const targetDir = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');

try {
  console.log('1. Modifying generator output in schema.prisma...');
  const modifiedSchema = originalSchema.replace(
    /generator\s+client\s+\{[\s\S]*?\}/,
    `generator client {\n  provider = "prisma-client-js"\n  output   = "../node_modules/.prisma/temp_client"\n}`
  );
  fs.writeFileSync(schemaPath, modifiedSchema, 'utf8');

  console.log('2. Running npx prisma generate...');
  execSync('npx prisma generate', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });

  console.log('3. Copying generated files to target .prisma/client (skipping locked dll)...');
  const files = fs.readdirSync(tempOutputDir);
  for (const file of files) {
    if (file.endsWith('.dll.node')) {
      console.log(`Skipping locked engine file: ${file}`);
      continue;
    }
    const srcFile = path.join(tempOutputDir, file);
    const destFile = path.join(targetDir, file);
    fs.cpSync(srcFile, destFile, { recursive: true, force: true });
    console.log(`Copied ${file} -> .prisma/client/`);
  }

  console.log('4. Cleaning up temp directory...');
  fs.rmSync(tempOutputDir, { recursive: true, force: true });

  console.log('✔ Successfully generated and synchronized Prisma client types!');
} catch (err) {
  console.error('Generation failed:', err);
} finally {
  console.log('Restoring original schema.prisma...');
  fs.writeFileSync(schemaPath, originalSchema, 'utf8');
}
