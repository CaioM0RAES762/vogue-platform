import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Iniciando seed...');

  await seedAdmin();
  await seedCategories();

  console.log('✅ Seed concluído.');
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Variáveis ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórias no .env para o seed.',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ⏭  Admin já existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.create({
    data: {
      name: 'Administrador',
      email,
      cpf: '000.000.000-00',
      phone: '(00) 00000-0000',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`  ✓  Admin criado: ${email}`);
}

async function seedCategories() {
  const categories = [
    { name: 'Vestidos', slug: 'vestidos', sortOrder: 1 },
    { name: 'Blusas', slug: 'blusas', sortOrder: 2 },
    { name: 'Calças', slug: 'calcas', sortOrder: 3 },
    { name: 'Saias', slug: 'saias', sortOrder: 4 },
    { name: 'Conjuntos', slug: 'conjuntos', sortOrder: 5 },
    { name: 'Acessórios', slug: 'acessorios', sortOrder: 6 },
  ];

  for (const cat of categories) {
    const existing = await prisma.category.findUnique({ where: { slug: cat.slug } });
    if (existing) {
      console.log(`  ⏭  Categoria já existe: ${cat.name}`);
      continue;
    }

    await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        isActive: true,
        sortOrder: cat.sortOrder,
      },
    });

    console.log(`  ✓  Categoria criada: ${cat.name}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
