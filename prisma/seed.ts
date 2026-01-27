import { PrismaClient, AlbumStatus } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({
  adapter,
});


async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data (for development only)
  // Note: Order matters due to foreign key constraints
  console.log('🧹 Clearing existing data...');
  await prisma.photoSelection.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.albumClient.deleteMany();
  await prisma.album.deleteMany();
  await prisma.photographer.deleteMany(); // Must delete before User due to FK
  await prisma.session.deleteMany(); // Better-auth sessions
  await prisma.account.deleteMany(); // Better-auth accounts
  await prisma.verification.deleteMany(); // Better-auth verification
  await prisma.user.deleteMany();

  // Create User records (better-auth managed)
  // Note: In production, users should be created via better-auth sign-up flow
  // For seeding, we create them directly, but passwords are managed by better-auth
  console.log('👤 Creating user accounts...');
  // Generate IDs for better-auth User records (better-auth doesn't auto-generate)
  const userId1 = `user_${Date.now()}_1`;
  const userId2 = `user_${Date.now()}_2`;
  
  const user1 = await prisma.user.create({
    data: {
      id: userId1,
      email: 'photographer1@example.com',
      name: 'John Photographer',
      emailVerified: true, // For testing, mark as verified
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: userId2,
      email: 'photographer2@example.com',
      name: 'Jane Smith',
      emailVerified: true, // For testing, mark as verified
    },
  });

  // Create Account records for email/password authentication
  // Better-auth stores passwords in the Account model, not User
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.account.create({
    data: {
      id: `account-${user1.id}`,
      accountId: user1.email,
      providerId: 'credential',
      userId: user1.id,
      password: hashedPassword,
    },
  });

  await prisma.account.create({
    data: {
      id: `account-${user2.id}`,
      accountId: user2.email,
      providerId: 'credential',
      userId: user2.id,
      password: hashedPassword,
    },
  });

  // Create Photographer records (business data)
  console.log('📸 Creating photographer profiles...');
  const photographer1 = await prisma.photographer.create({
    data: {
      userId: user1.id,
      name: 'John Photographer',
    },
  });

  const photographer2 = await prisma.photographer.create({
    data: {
      userId: user2.id,
      name: 'Jane Smith',
    },
  });

  console.log(`✅ Created ${2} photographers`);

  // Create albums with various statuses
  console.log('📸 Creating albums...');
  const weddingAlbum = await prisma.album.create({
    data: {
      title: 'Summer Wedding 2024',
      description: 'Beautiful outdoor wedding ceremony and reception',
      status: AlbumStatus.OPEN,
      photographerId: photographer1.id, // Changed from userId
    },
  });

  const portraitAlbum = await prisma.album.create({
    data: {
      title: 'Family Portraits',
      description: 'Professional family portrait session',
      status: AlbumStatus.OPEN,
      photographerId: photographer1.id, // Changed from userId
    },
  });

  const draftAlbum = await prisma.album.create({
    data: {
      title: 'Corporate Event - Draft',
      description: 'Company annual meeting photos',
      status: AlbumStatus.DRAFT,
      photographerId: photographer1.id, // Changed from userId
    },
  });

  const closedAlbum = await prisma.album.create({
    data: {
      title: 'Graduation Ceremony 2023',
      description: 'High school graduation photos',
      status: AlbumStatus.CLOSED,
      photographerId: photographer2.id, // Changed from userId
    },
  });

  const archivedAlbum = await prisma.album.create({
    data: {
      title: 'Old Project Archive',
      description: 'Archived project from 2022',
      status: AlbumStatus.ARCHIVED,
      photographerId: photographer2.id, // Changed from userId
    },
  });

  console.log(`✅ Created ${5} albums with various statuses`);

  // Create photos for albums
  console.log('🖼️  Creating photos...');
  const weddingPhotos = await Promise.all([
    prisma.photo.create({
      data: {
        filename: 'wedding-001.jpg',
        originalFilename: 'DSC_001.jpg',
        mimeType: 'image/jpeg',
        size: 2456789,
        width: 6000,
        height: 4000,
        storageKey: 'albums/wedding-001.jpg',
        thumbnailStorageKey: 'albums/thumbnails/wedding-001.jpg',
        albumId: weddingAlbum.id,
        exifCameraMake: 'Nikon',
        exifCameraModel: 'D850',
        exifIso: 400,
        exifFocalLength: 50.0,
        exifAperture: 2.8,
        exifShutterSpeed: '1/125',
        exifDateTimeOriginal: new Date('2024-07-15T14:30:00Z'),
      },
    }),
    prisma.photo.create({
      data: {
        filename: 'wedding-002.jpg',
        originalFilename: 'DSC_002.jpg',
        mimeType: 'image/jpeg',
        size: 2234567,
        width: 6000,
        height: 4000,
        storageKey: 'albums/wedding-002.jpg',
        thumbnailStorageKey: 'albums/thumbnails/wedding-002.jpg',
        albumId: weddingAlbum.id,
        exifCameraMake: 'Nikon',
        exifCameraModel: 'D850',
        exifIso: 400,
        exifFocalLength: 85.0,
        exifAperture: 1.8,
        exifShutterSpeed: '1/200',
        exifDateTimeOriginal: new Date('2024-07-15T15:00:00Z'),
      },
    }),
    prisma.photo.create({
      data: {
        filename: 'wedding-003.jpg',
        originalFilename: 'DSC_003.jpg',
        mimeType: 'image/jpeg',
        size: 2678901,
        width: 6000,
        height: 4000,
        storageKey: 'albums/wedding-003.jpg',
        thumbnailStorageKey: 'albums/thumbnails/wedding-003.jpg',
        albumId: weddingAlbum.id,
        exifCameraMake: 'Nikon',
        exifCameraModel: 'D850',
        exifIso: 200,
        exifFocalLength: 24.0,
        exifAperture: 4.0,
        exifShutterSpeed: '1/60',
        exifDateTimeOriginal: new Date('2024-07-15T16:00:00Z'),
      },
    }),
  ]);

  const portraitPhotos = await Promise.all([
    prisma.photo.create({
      data: {
        filename: 'portrait-001.jpg',
        originalFilename: 'IMG_1001.jpg',
        mimeType: 'image/jpeg',
        size: 1890123,
        width: 4000,
        height: 6000,
        storageKey: 'albums/portrait-001.jpg',
        thumbnailStorageKey: 'albums/thumbnails/portrait-001.jpg',
        albumId: portraitAlbum.id,
        exifCameraMake: 'Canon',
        exifCameraModel: 'EOS R5',
        exifIso: 100,
        exifFocalLength: 85.0,
        exifAperture: 2.0,
        exifShutterSpeed: '1/250',
        exifDateTimeOriginal: new Date('2024-08-20T10:00:00Z'),
      },
    }),
    prisma.photo.create({
      data: {
        filename: 'portrait-002.jpg',
        originalFilename: 'IMG_1002.jpg',
        mimeType: 'image/jpeg',
        size: 1923456,
        width: 4000,
        height: 6000,
        storageKey: 'albums/portrait-002.jpg',
        thumbnailStorageKey: 'albums/thumbnails/portrait-002.jpg',
        albumId: portraitAlbum.id,
        exifCameraMake: 'Canon',
        exifCameraModel: 'EOS R5',
        exifIso: 100,
        exifFocalLength: 85.0,
        exifAperture: 2.0,
        exifShutterSpeed: '1/200',
        exifDateTimeOriginal: new Date('2024-08-20T10:15:00Z'),
      },
    }),
  ]);

  console.log(`✅ Created ${weddingPhotos.length + portraitPhotos.length} photos`);

  // Create album clients
  console.log('👥 Creating album clients...');
  const client1 = await prisma.albumClient.create({
    data: {
      clientName: 'Sarah Johnson',
      clientEmail: 'sarah.johnson@example.com',
      accessToken: 'wedding-token-abc123xyz',
      expiresAt: new Date('2025-12-31T23:59:59Z'),
      albumId: weddingAlbum.id,
    },
  });

  const client2 = await prisma.albumClient.create({
    data: {
      clientName: 'Michael Brown',
      clientEmail: 'michael.brown@example.com',
      accessToken: 'portrait-token-def456uvw',
      expiresAt: new Date('2025-12-31T23:59:59Z'),
      albumId: portraitAlbum.id,
    },
  });

  const client3 = await prisma.albumClient.create({
    data: {
      clientName: 'Emily Davis',
      clientEmail: 'emily.davis@example.com',
      accessToken: 'wedding-token-ghi789rst',
      expiresAt: null, // No expiration
      albumId: weddingAlbum.id,
    },
  });

  console.log(`✅ Created ${3} album clients`);

  // Create photo selections
  console.log('⭐ Creating photo selections...');
  await prisma.photoSelection.create({
    data: {
      photoId: weddingPhotos[0].id,
      clientId: client1.id,
      notes: 'Love this one! Perfect for the save-the-date card.',
    },
  });

  await prisma.photoSelection.create({
    data: {
      photoId: weddingPhotos[1].id,
      clientId: client1.id,
      notes: 'Great candid moment',
    },
  });

  await prisma.photoSelection.create({
    data: {
      photoId: portraitPhotos[0].id,
      clientId: client2.id,
      notes: 'This is our favorite family photo',
    },
  });

  await prisma.photoSelection.create({
    data: {
      photoId: weddingPhotos[2].id,
      clientId: client3.id,
      notes: null,
    },
  });

  console.log(`✅ Created ${4} photo selections`);

  console.log('✨ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${2} photographers`);
  console.log(`   - ${5} albums (DRAFT, OPEN, CLOSED, ARCHIVED)`);
  console.log(`   - ${weddingPhotos.length + portraitPhotos.length} photos`);
  console.log(`   - ${3} album clients`);
  console.log(`   - ${4} photo selections`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

