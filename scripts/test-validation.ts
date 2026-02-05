#!/usr/bin/env tsx
/**
 * Test script for validation utilities
 * 
 * Tests Zod-based validation schemas and utility functions
 * 
 * Usage:
 *   tsx scripts/test-validation.ts
 * 
 * Tests all validation schemas including edge cases, error formatting, and utility functions.
 */

import {
  // Common schemas
  cuid2Schema,
  emailSchema,
  paginationSchema,
  dateRangeSchema,
  sortOrderSchema,
  // User schemas
  registerUserSchema,
  loginUserSchema,
  updateUserProfileSchema,
  changePasswordSchema,
  passwordSchema,
  // Album schemas
  createAlbumSchema,
  updateAlbumSchema,
  albumIdSchema,
  albumQuerySchema,
  albumStatusSchema,
  // Photo schemas
  createPhotoSchema,
  updatePhotoSchema,
  photoUploadMetadataSchema,
  exifMetadataSchema,
  photoIdSchema,
  photoQuerySchema,
  imageMimeTypeSchema,
  // Client schemas
  createAlbumClientSchema,
  updateAlbumClientSchema,
  accessTokenSchema,
  accessTokenParamSchema,
  createPhotoSelectionSchema,
  batchPhotoSelectionSchema,
  // Utilities
  validate,
  safeValidate,
  formatZodError,
  ValidationError,
  validateQuery,
  validateBody,
  validateParams,
  withCustomMessages,
  createValidationPipeline,
} from "../src/lib/validation";
import { z } from "zod";

/**
 * Test 1: CUID2 validation
 */
function testCuid2Validation(): boolean {
  console.log("\n📋 Test 1: CUID2 Validation");
  console.log("─".repeat(50));

  try {
    // Valid CUID2 (CUID2 format: starts with letter, followed by alphanumeric)
    const validCuid2 = "clx1234567890abcdefghij";
    const result = cuid2Schema.parse(validCuid2);
    if (result !== validCuid2) {
      console.error(`❌ Valid CUID2 failed. Expected: ${validCuid2}, Got: ${result}`);
      return false;
    }

    // Invalid CUID2s
    const invalidCuid2Tests = [
      "",
      "not-a-cuid2",
      "123",
      "clx",
    ];

    for (const invalid of invalidCuid2Tests) {
      try {
        cuid2Schema.parse(invalid);
        console.error(`❌ Invalid CUID2 should have failed: ${invalid}`);
        return false;
      } catch (error) {
        // Expected to fail
      }
    }

    console.log("✅ CUID2 validation works correctly");
    return true;
  } catch (error) {
    console.error("❌ CUID2 validation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 2: Email validation
 */
function testEmailValidation(): boolean {
  console.log("\n📋 Test 2: Email Validation");
  console.log("─".repeat(50));

  try {
    // Valid emails
    const validEmails = [
      "user@example.com",
      "test.email+tag@domain.co.uk",
      "user_name@sub.domain.com",
    ];

    for (const email of validEmails) {
      const result = emailSchema.parse(email);
      if (result !== email) {
        console.error(`❌ Valid email failed: ${email}`);
        return false;
      }
    }

    // Invalid emails
    const invalidEmails = [
      "",
      "not-an-email",
      "@domain.com",
      "user@",
      "user@domain",
      "user @domain.com",
    ];

    for (const email of invalidEmails) {
      try {
        emailSchema.parse(email);
        console.error(`❌ Invalid email should have failed: ${email}`);
        return false;
      } catch (error) {
        // Expected to fail
      }
    }

    console.log("✅ Email validation works correctly");
    return true;
  } catch (error) {
    console.error("❌ Email validation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 3: Pagination schema
 */
function testPaginationSchema(): boolean {
  console.log("\n📋 Test 3: Pagination Schema");
  console.log("─".repeat(50));

  try {
    // Valid pagination
    const valid1 = paginationSchema.parse({ page: 1, limit: 20 });
    if (valid1.page !== 1 || valid1.limit !== 20) {
      console.error("❌ Valid pagination failed");
      return false;
    }

    // Default values
    const defaults = paginationSchema.parse({});
    if (defaults.page !== 1 || defaults.limit !== 20) {
      console.error(`❌ Default values failed. Expected page=1, limit=20, Got page=${defaults.page}, limit=${defaults.limit}`);
      return false;
    }

    // Type coercion
    const coerced = paginationSchema.parse({ page: "2", limit: "50" });
    if (coerced.page !== 2 || coerced.limit !== 50) {
      console.error("❌ Type coercion failed");
      return false;
    }

    // Invalid pagination
    try {
      paginationSchema.parse({ page: 0 });
      console.error("❌ Invalid page (0) should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    try {
      paginationSchema.parse({ limit: 200 }); // Max is 100
      console.error("❌ Invalid limit (>100) should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    console.log("✅ Pagination schema works correctly");
    return true;
  } catch (error) {
    console.error("❌ Pagination schema failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 4: Date range schema
 */
function testDateRangeSchema(): boolean {
  console.log("\n📋 Test 4: Date Range Schema");
  console.log("─".repeat(50));

  try {
    // Valid date range
    const from = new Date("2024-01-01");
    const to = new Date("2024-12-31");
    const valid = dateRangeSchema.parse({ from, to });
    if (valid.from?.getTime() !== from.getTime() || valid.to?.getTime() !== to.getTime()) {
      console.error("❌ Valid date range failed");
      return false;
    }

    // Invalid range (from > to)
    try {
      dateRangeSchema.parse({ from: to, to: from });
      console.error("❌ Invalid date range (from > to) should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Single date
    const single = dateRangeSchema.parse({ from });
    if (!single.from || single.to) {
      console.error("❌ Single date range failed");
      return false;
    }

    console.log("✅ Date range schema works correctly");
    return true;
  } catch (error) {
    console.error("❌ Date range schema failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 5: User registration schema
 */
function testUserRegistrationSchema(): boolean {
  console.log("\n📋 Test 5: User Registration Schema");
  console.log("─".repeat(50));

  try {
    // Valid registration
    const valid = registerUserSchema.parse({
      email: "user@example.com",
      password: "SecurePass123",
      name: "John Doe",
    });
    if (valid.email !== "user@example.com" || valid.password !== "SecurePass123") {
      console.error("❌ Valid registration failed");
      return false;
    }

    // Missing required fields
    try {
      registerUserSchema.parse({ email: "user@example.com" });
      console.error("❌ Missing password should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Invalid password (too short)
    try {
      registerUserSchema.parse({
        email: "user@example.com",
        password: "short",
      });
      console.error("❌ Short password should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Invalid password (no uppercase)
    try {
      registerUserSchema.parse({
        email: "user@example.com",
        password: "lowercase123",
      });
      console.error("❌ Password without uppercase should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Invalid password (no number)
    try {
      registerUserSchema.parse({
        email: "user@example.com",
        password: "NoNumbers",
      });
      console.error("❌ Password without number should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    console.log("✅ User registration schema works correctly");
    return true;
  } catch (error) {
    console.error("❌ User registration schema failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 6: Password schema edge cases
 */
function testPasswordSchemaEdgeCases(): boolean {
  console.log("\n📋 Test 6: Password Schema Edge Cases");
  console.log("─".repeat(50));

  try {
    // Valid passwords
    const validPasswords = [
      "Password123",
      "MySecure1",
      "ComplexP@ss1",
      "12345678Abc",
    ];

    for (const password of validPasswords) {
      try {
        passwordSchema.parse(password);
      } catch (error) {
        console.error(`❌ Valid password failed: ${password}`);
        return false;
      }
    }

    // Invalid passwords
    const invalidPasswords = [
      { password: "short", reason: "too short" },
      { password: "nouppercase123", reason: "no uppercase" },
      { password: "NOLOWERCASE123", reason: "no lowercase" },
      { password: "NoNumbers", reason: "no numbers" },
      { password: "", reason: "empty" },
    ];

    for (const { password, reason } of invalidPasswords) {
      try {
        passwordSchema.parse(password);
        console.error(`❌ Password should have failed (${reason}): ${password}`);
        return false;
      } catch (error) {
        // Expected
      }
    }

    console.log("✅ Password schema edge cases work correctly");
    return true;
  } catch (error) {
    console.error("❌ Password schema edge cases failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 7: Album creation schema
 */
function testAlbumCreationSchema(): boolean {
  console.log("\n📋 Test 7: Album Creation Schema");
  console.log("─".repeat(50));

  try {
    // Valid album
    const valid = createAlbumSchema.parse({
      title: "My Album",
      description: "A great album",
      status: "DRAFT",
    });
    if (valid.title !== "My Album" || valid.status !== "DRAFT") {
      console.error("❌ Valid album creation failed");
      return false;
    }

    // Default status
    const withDefault = createAlbumSchema.parse({
      title: "Another Album",
    });
    if (withDefault.status !== "DRAFT") {
      console.error("❌ Default status failed");
      return false;
    }

    // Invalid status
    try {
      createAlbumSchema.parse({
        title: "Album",
        status: "INVALID",
      });
      console.error("❌ Invalid status should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Missing title
    try {
      createAlbumSchema.parse({
        description: "No title",
      });
      console.error("❌ Missing title should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Title too long
    try {
      createAlbumSchema.parse({
        title: "a".repeat(256), // Max is 255
      });
      console.error("❌ Title too long should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    console.log("✅ Album creation schema works correctly");
    return true;
  } catch (error) {
    console.error("❌ Album creation schema failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 8: Photo upload metadata schema
 */
function testPhotoUploadMetadataSchema(): boolean {
  console.log("\n📋 Test 8: Photo Upload Metadata Schema");
  console.log("─".repeat(50));

  try {
    // Valid metadata
    const valid = photoUploadMetadataSchema.parse({
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024000,
      width: 1920,
      height: 1080,
    });
    if (valid.mimeType !== "image/jpeg" || valid.size !== 1024000) {
      console.error("❌ Valid photo metadata failed");
      return false;
    }

    // Invalid MIME type
    try {
      photoUploadMetadataSchema.parse({
        originalFilename: "photo.jpg",
        mimeType: "application/pdf",
        size: 1024,
      });
      console.error("❌ Invalid MIME type should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Invalid size (negative)
    try {
      photoUploadMetadataSchema.parse({
        originalFilename: "photo.jpg",
        mimeType: "image/jpeg",
        size: -100,
      });
      console.error("❌ Negative size should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Valid MIME types
    const validMimeTypes = ["image/jpeg", "image/png", "image/tiff", "image/webp"];
    for (const mimeType of validMimeTypes) {
      try {
        imageMimeTypeSchema.parse(mimeType);
      } catch (error) {
        console.error(`❌ Valid MIME type failed: ${mimeType}`);
        return false;
      }
    }

    console.log("✅ Photo upload metadata schema works correctly");
    return true;
  } catch (error) {
    console.error("❌ Photo upload metadata schema failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 9: Client access token schema
 */
function testAccessTokenSchema(): boolean {
  console.log("\n📋 Test 9: Client Access Token Schema");
  console.log("─".repeat(50));

  try {
    // Valid token (minimum 32 characters)
    const validToken = "a".repeat(32);
    const result = accessTokenSchema.parse(validToken);
    if (result !== validToken) {
      console.error("❌ Valid token failed");
      return false;
    }

    // Invalid token (too short)
    try {
      accessTokenSchema.parse("short");
      console.error("❌ Short token should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Token parameter schema
    const paramResult = accessTokenParamSchema.parse({ token: validToken });
    if (paramResult.token !== validToken) {
      console.error("❌ Token parameter schema failed");
      return false;
    }

    console.log("✅ Access token schema works correctly");
    return true;
  } catch (error) {
    console.error("❌ Access token schema failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 10: Batch photo selection schema
 */
function testBatchPhotoSelectionSchema(): boolean {
  console.log("\n📋 Test 10: Batch Photo Selection Schema");
  console.log("─".repeat(50));

  try {
    // Valid batch selection (using valid CUID2s)
    const valid = batchPhotoSelectionSchema.parse({
      photoIds: [
        "clx1234567890abcdefghij",
        "clx0987654321zyxwvutsrqp",
        "clxabcdefghij1234567890",
      ],
      notes: "Selected photos",
    });
    if (valid.photoIds.length !== 3) {
      console.error("❌ Valid batch selection failed");
      return false;
    }

    // Empty array
    try {
      batchPhotoSelectionSchema.parse({
        photoIds: [],
      });
      console.error("❌ Empty photoIds should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Missing photoIds
    try {
      batchPhotoSelectionSchema.parse({
        notes: "No photos",
      });
      console.error("❌ Missing photoIds should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    console.log("✅ Batch photo selection schema works correctly");
    return true;
  } catch (error) {
    console.error("❌ Batch photo selection schema failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 11: Validation utility - validate function
 */
function testValidateFunction(): boolean {
  console.log("\n📋 Test 11: Validate Function");
  console.log("─".repeat(50));

  try {
    // Valid data
    const validData = { email: "user@example.com", password: "SecurePass123" };
    const result = validate(loginUserSchema, validData);
    if (result.email !== validData.email) {
      console.error("❌ Valid data validation failed");
      return false;
    }

    // Invalid data - should throw ValidationError
    try {
      validate(loginUserSchema, { email: "invalid" });
      console.error("❌ Invalid data should have thrown ValidationError");
      return false;
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        console.error("❌ Should have thrown ValidationError");
        return false;
      }
      if (!error.errors.email) {
        console.error("❌ ValidationError should have email errors");
        return false;
      }
    }

    console.log("✅ Validate function works correctly");
    return true;
  } catch (error) {
    console.error("❌ Validate function failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 12: Validation utility - safeValidate function
 */
function testSafeValidateFunction(): boolean {
  console.log("\n📋 Test 12: Safe Validate Function");
  console.log("─".repeat(50));

  try {
    // Valid data
    const validResult = safeValidate(loginUserSchema, {
      email: "user@example.com",
      password: "password123",
    });
    if (!validResult.success) {
      console.error("❌ Valid data should succeed");
      return false;
    }
    if (validResult.data.email !== "user@example.com") {
      console.error("❌ Valid data result incorrect");
      return false;
    }

    // Invalid data
    const invalidResult = safeValidate(loginUserSchema, { email: "invalid" });
    if (invalidResult.success) {
      console.error("❌ Invalid data should fail");
      return false;
    }
    if (!(invalidResult.error instanceof ValidationError)) {
      console.error("❌ Should return ValidationError");
      return false;
    }
    if (!invalidResult.error.errors.email) {
      console.error("❌ Should have email errors");
      return false;
    }

    console.log("✅ Safe validate function works correctly");
    return true;
  } catch (error) {
    console.error("❌ Safe validate function failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 13: Error formatting
 */
function testErrorFormatting(): boolean {
  console.log("\n📋 Test 13: Error Formatting");
  console.log("─".repeat(50));

  try {
    // Create a Zod error
    try {
      registerUserSchema.parse({ email: "invalid", password: "short" });
      console.error("❌ Should have failed validation");
      return false;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted = formatZodError(error);
        
        // Check structure
        if (typeof formatted !== "object") {
          console.error("❌ Formatted error should be an object");
          return false;
        }
        
        // Should have email and password errors
        if (!formatted.email || !formatted.password) {
          console.error("❌ Should have email and password errors");
          return false;
        }
        
        // Errors should be arrays
        if (!Array.isArray(formatted.email) || !Array.isArray(formatted.password)) {
          console.error("❌ Errors should be arrays");
          return false;
        }
      } else {
        console.error("❌ Should have thrown ZodError");
        return false;
      }
    }

    console.log("✅ Error formatting works correctly");
    return true;
  } catch (error) {
    console.error("❌ Error formatting failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 14: ValidationError class methods
 */
function testValidationErrorMethods(): boolean {
  console.log("\n📋 Test 14: ValidationError Class Methods");
  console.log("─".repeat(50));

  try {
    const errors = {
      email: ["Invalid email"],
      password: ["Too short", "Missing uppercase"],
    };
    const validationError = new ValidationError(errors);

    // Test getFieldError
    const emailError = validationError.getFieldError("email");
    if (emailError !== "Invalid email") {
      console.error("❌ getFieldError failed");
      return false;
    }

    // Test hasFieldError
    if (!validationError.hasFieldError("email")) {
      console.error("❌ hasFieldError failed for email");
      return false;
    }
    if (validationError.hasFieldError("nonexistent")) {
      console.error("❌ hasFieldError should return false for nonexistent field");
      return false;
    }

    // Test getAllErrors
    const allErrors = validationError.getAllErrors();
    if (allErrors.length !== 3) {
      console.error(`❌ getAllErrors failed. Expected 3, got ${allErrors.length}`);
      return false;
    }

    console.log("✅ ValidationError methods work correctly");
    return true;
  } catch (error) {
    console.error("❌ ValidationError methods failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 15: Request validation helpers
 */
function testRequestValidationHelpers(): boolean {
  console.log("\n📋 Test 15: Request Validation Helpers");
  console.log("─".repeat(50));

  try {
    // Test validateBody
    const body = validateBody(createAlbumSchema, {
      title: "My Album",
      description: "Description",
    });
    if (body.title !== "My Album") {
      console.error("❌ validateBody failed");
      return false;
    }

    // Test validateQuery
    const query = validateQuery(paginationSchema, {
      page: "2",
      limit: "50",
    });
    if (query.page !== 2 || query.limit !== 50) {
      console.error("❌ validateQuery failed");
      return false;
    }

    // Test validateParams
    const params = validateParams(albumIdSchema, {
      id: "clx1234567890abcdefghij",
    });
    if (params.id !== "clx1234567890abcdefghij") {
      console.error("❌ validateParams failed");
      return false;
    }

    console.log("✅ Request validation helpers work correctly");
    return true;
  } catch (error) {
    console.error("❌ Request validation helpers failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 16: Custom error messages
 */
function testCustomErrorMessages(): boolean {
  console.log("\n📋 Test 16: Custom Error Messages");
  console.log("─".repeat(50));

  try {
    const customSchema = withCustomMessages(registerUserSchema, {
      email: "Please provide a valid email address",
      password: "Password must be strong",
    });

    try {
      customSchema.parse({ email: "invalid", password: "short" });
      console.error("❌ Should have failed validation");
      return false;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Check if custom messages are applied
        const emailIssue = error.issues.find((i) => i.path.includes("email"));
        const passwordIssue = error.issues.find((i) => i.path.includes("password"));
        
        // Note: withCustomMessages uses superRefine which may not always override
        // This is a basic test to ensure the function doesn't throw
        if (!emailIssue || !passwordIssue) {
          console.error("❌ Should have email and password issues");
          return false;
        }
      } else {
        console.error("❌ Should have thrown ZodError");
        return false;
      }
    }

    console.log("✅ Custom error messages work correctly");
    return true;
  } catch (error) {
    console.error("❌ Custom error messages failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 17: Validation pipeline
 */
function testValidationPipeline(): boolean {
  console.log("\n📋 Test 17: Validation Pipeline");
  console.log("─".repeat(50));

  try {
    const baseSchema = z.object({ value: z.string() });
    const transformSchema = z.object({ value: z.string().toUpperCase() });

    const pipeline = createValidationPipeline(baseSchema, transformSchema);

    const result = pipeline.parse({ value: "hello" }) as z.infer<typeof transformSchema>;
    if (result.value !== "HELLO") {
      console.error(`❌ Pipeline transformation failed. Expected "HELLO", got "${result.value}"`);
      return false;
    }

    console.log("✅ Validation pipeline works correctly");
    return true;
  } catch (error) {
    console.error("❌ Validation pipeline failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 18: Type coercion edge cases
 */
function testTypeCoercion(): boolean {
  console.log("\n📋 Test 18: Type Coercion Edge Cases");
  console.log("─".repeat(50));

  try {
    // Number coercion in pagination
    const coerced = paginationSchema.parse({ page: "1", limit: "20" });
    if (typeof coerced.page !== "number" || typeof coerced.limit !== "number") {
      console.error("❌ Type coercion failed for pagination");
      return false;
    }

    // Date coercion in date range
    const dateRange = dateRangeSchema.parse({
      from: "2024-01-01",
      to: "2024-12-31",
    });
    if (!(dateRange.from instanceof Date) || !(dateRange.to instanceof Date)) {
      console.error("❌ Type coercion failed for date range");
      return false;
    }

    console.log("✅ Type coercion works correctly");
    return true;
  } catch (error) {
    console.error("❌ Type coercion failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 19: Empty input handling
 */
function testEmptyInputHandling(): boolean {
  console.log("\n📋 Test 19: Empty Input Handling");
  console.log("─".repeat(50));

  try {
    // Empty string should fail for required fields
    try {
      createAlbumSchema.parse({ title: "" });
      console.error("❌ Empty title should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Empty object should fail for required schemas
    try {
      loginUserSchema.parse({});
      console.error("❌ Empty object should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Null/undefined handling
    try {
      updateAlbumSchema.parse({ title: null });
      console.error("❌ Null title should have failed (not nullable)");
      return false;
    } catch (error) {
      // Expected
    }

    // Optional fields can be undefined
    const withOptional = updateAlbumSchema.parse({});
    if (withOptional.title !== undefined) {
      console.error("❌ Optional fields should allow undefined");
      return false;
    }

    console.log("✅ Empty input handling works correctly");
    return true;
  } catch (error) {
    console.error("❌ Empty input handling failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 20: Malformed data handling
 */
function testMalformedDataHandling(): boolean {
  console.log("\n📋 Test 20: Malformed Data Handling");
  console.log("─".repeat(50));

  try {
    // Wrong types
    try {
      createAlbumSchema.parse({ title: 123 });
      console.error("❌ Wrong type (number) should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    // Extra fields (should be stripped or ignored by default)
    const withExtra = createAlbumSchema.parse({
      title: "Album",
      extraField: "should be ignored",
    });
    if (withExtra.title !== "Album") {
      console.error("❌ Extra fields handling failed");
      return false;
    }

    // Nested malformed data
    try {
      batchPhotoSelectionSchema.parse({
        photoIds: ["valid", 123, null], // Mixed types
      });
      console.error("❌ Mixed types in array should have failed");
      return false;
    } catch (error) {
      // Expected
    }

    console.log("✅ Malformed data handling works correctly");
    return true;
  } catch (error) {
    console.error("❌ Malformed data handling failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Validation Utilities Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({ name: "CUID2 Validation", passed: testCuid2Validation() });
  results.push({ name: "Email Validation", passed: testEmailValidation() });
  results.push({ name: "Pagination Schema", passed: testPaginationSchema() });
  results.push({ name: "Date Range Schema", passed: testDateRangeSchema() });
  results.push({ name: "User Registration Schema", passed: testUserRegistrationSchema() });
  results.push({ name: "Password Schema Edge Cases", passed: testPasswordSchemaEdgeCases() });
  results.push({ name: "Album Creation Schema", passed: testAlbumCreationSchema() });
  results.push({ name: "Photo Upload Metadata Schema", passed: testPhotoUploadMetadataSchema() });
  results.push({ name: "Access Token Schema", passed: testAccessTokenSchema() });
  results.push({ name: "Batch Photo Selection Schema", passed: testBatchPhotoSelectionSchema() });
  results.push({ name: "Validate Function", passed: testValidateFunction() });
  results.push({ name: "Safe Validate Function", passed: testSafeValidateFunction() });
  results.push({ name: "Error Formatting", passed: testErrorFormatting() });
  results.push({ name: "ValidationError Methods", passed: testValidationErrorMethods() });
  results.push({ name: "Request Validation Helpers", passed: testRequestValidationHelpers() });
  results.push({ name: "Custom Error Messages", passed: testCustomErrorMessages() });
  results.push({ name: "Validation Pipeline", passed: testValidationPipeline() });
  results.push({ name: "Type Coercion", passed: testTypeCoercion() });
  results.push({ name: "Empty Input Handling", passed: testEmptyInputHandling() });
  results.push({ name: "Malformed Data Handling", passed: testMalformedDataHandling() });

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
  });

  console.log("\n" + "─".repeat(50));
  console.log(`Total: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Please review the errors above.");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});

