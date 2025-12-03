#!/usr/bin/env tsx
/**
 * Test script for error handling framework
 * 
 * Tests error classes, utilities, and middleware for Express/Next.js
 * 
 * Usage:
 *   tsx scripts/test-errors.ts
 * 
 * Tests all error classes, error utilities, serialization, and middleware functionality.
 */

import "dotenv/config";

import {
  BaseError,
  HttpStatusCode,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  TokenError,
  NotFoundError,
  ConflictError,
  isBaseError,
  isValidationError,
  toBaseError,
  getErrorStatusCode,
  serializeErrorForLogging,
  serializeErrorForClient,
  shouldLogError,
  getClientErrorMessage,
} from "../src/lib/errors";
import { z } from "zod";

/**
 * Test 1: BaseError basic functionality
 */
function testBaseErrorBasic(): boolean {
  console.log("\n📋 Test 1: BaseError Basic Functionality");
  console.log("─".repeat(50));

  try {
    class TestError extends BaseError {
      constructor(message: string) {
        super(message, HttpStatusCode.BAD_REQUEST);
      }
    }

    const error = new TestError("Test error message");

    // Check properties
    if (error.message !== "Test error message") {
      console.error(`❌ Message mismatch. Expected: "Test error message", Got: ${error.message}`);
      return false;
    }

    if (error.statusCode !== HttpStatusCode.BAD_REQUEST) {
      console.error(`❌ Status code mismatch. Expected: ${HttpStatusCode.BAD_REQUEST}, Got: ${error.statusCode}`);
      return false;
    }

    if (error.name !== "TestError") {
      console.error(`❌ Name mismatch. Expected: "TestError", Got: ${error.name}`);
      return false;
    }

    if (!error.isOperational) {
      console.error(`❌ isOperational should be true by default`);
      return false;
    }

    if (!(error.timestamp instanceof Date)) {
      console.error(`❌ timestamp should be a Date instance`);
      return false;
    }

    console.log("✅ BaseError basic functionality works correctly");
    return true;
  } catch (error) {
    console.error("❌ BaseError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 2: BaseError serialization
 */
function testBaseErrorSerialization(): boolean {
  console.log("\n📋 Test 2: BaseError Serialization");
  console.log("─".repeat(50));

  try {
    class TestError extends BaseError {
      constructor(message: string) {
        super(message, HttpStatusCode.BAD_REQUEST, true, { field: "value" });
      }
    }

    const error = new TestError("Test error");

    // Test toJSON
    const json = error.toJSON(true, true);
    if (json.name !== "TestError") {
      console.error(`❌ JSON name mismatch. Expected: "TestError", Got: ${json.name}`);
      return false;
    }
    if (json.message !== "Test error") {
      console.error(`❌ JSON message mismatch`);
      return false;
    }
    if (json.statusCode !== HttpStatusCode.BAD_REQUEST) {
      console.error(`❌ JSON status code mismatch`);
      return false;
    }
    if (!json.timestamp) {
      console.error(`❌ JSON timestamp missing`);
      return false;
    }
    if (!json.context || json.context.field !== "value") {
      console.error(`❌ JSON context missing or incorrect`);
      return false;
    }
    if (!json.stack) {
      console.error(`❌ JSON stack missing when includeStack=true`);
      return false;
    }

    // Test toJSON without stack
    const jsonNoStack = error.toJSON(false, true);
    if (jsonNoStack.stack) {
      console.error(`❌ JSON should not include stack when includeStack=false`);
      return false;
    }

    // Test toClientJSON
    const clientJson = error.toClientJSON(false);
    if (clientJson.name !== "TestError") {
      console.error(`❌ Client JSON name mismatch`);
      return false;
    }
    if (clientJson.message !== "Test error") {
      console.error(`❌ Client JSON message mismatch`);
      return false;
    }
    if (clientJson.statusCode !== HttpStatusCode.BAD_REQUEST) {
      console.error(`❌ Client JSON status code mismatch`);
      return false;
    }
    if (clientJson.context) {
      console.error(`❌ Client JSON should not include context when includeDetails=false`);
      return false;
    }

    // Test toClientJSON with details
    const clientJsonWithDetails = error.toClientJSON(true);
    if (!clientJsonWithDetails.context || clientJsonWithDetails.context.field !== "value") {
      console.error(`❌ Client JSON should include context when includeDetails=true`);
      return false;
    }

    console.log("✅ BaseError serialization works correctly");
    return true;
  } catch (error) {
    console.error("❌ BaseError serialization test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 3: BaseError client message
 */
function testBaseErrorClientMessage(): boolean {
  console.log("\n📋 Test 3: BaseError Client Message");
  console.log("─".repeat(50));

  try {
    // Operational error
    class OperationalError extends BaseError {
      constructor(message: string) {
        super(message, HttpStatusCode.BAD_REQUEST, true);
      }
    }

    const operationalError = new OperationalError("Operational error");
    const operationalMessage = operationalError.getClientMessage(false);
    if (operationalMessage !== "Operational error") {
      console.error(`❌ Operational error message mismatch`);
      return false;
    }

    // Non-operational error
    class NonOperationalError extends BaseError {
      constructor(message: string) {
        super(message, HttpStatusCode.INTERNAL_SERVER_ERROR, false);
      }
    }

    const nonOperationalError = new NonOperationalError("Internal error");
    const nonOperationalMessage = nonOperationalError.getClientMessage(false);
    if (nonOperationalMessage !== "An unexpected error occurred") {
      console.error(`❌ Non-operational error should return generic message`);
      return false;
    }

    // Operational error with context
    const errorWithContext = new OperationalError("Error with context");
    errorWithContext.context = { field: "value" };
    const messageWithContext = errorWithContext.getClientMessage(true);
    if (!messageWithContext.includes("field: value")) {
      console.error(`❌ Error with context should include context in message`);
      return false;
    }

    console.log("✅ BaseError client message works correctly");
    return true;
  } catch (error) {
    console.error("❌ BaseError client message test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 4: ValidationError
 */
function testValidationError(): boolean {
  console.log("\n📋 Test 4: ValidationError");
  console.log("─".repeat(50));

  try {
    const errors = {
      email: ["Email is required", "Email must be valid"],
      password: ["Password must be at least 8 characters"],
    };

    const validationError = new ValidationError(errors, "Validation failed");

    // Check properties
    if (validationError.statusCode !== HttpStatusCode.UNPROCESSABLE_ENTITY) {
      console.error(`❌ ValidationError status code should be 422`);
      return false;
    }

    if (validationError.getFieldError("email") !== "Email is required") {
      console.error(`❌ getFieldError should return first error`);
      return false;
    }

    if (!validationError.hasFieldError("email")) {
      console.error(`❌ hasFieldError should return true for field with errors`);
      return false;
    }

    if (validationError.hasFieldError("nonexistent")) {
      console.error(`❌ hasFieldError should return false for field without errors`);
      return false;
    }

    const allErrors = validationError.getAllErrors();
    if (allErrors.length !== 3) {
      console.error(`❌ getAllErrors should return all error messages`);
      return false;
    }

    // Test serialization
    const json = validationError.toJSON(false, false);
    if (!json.errors || json.errors.email.length !== 2) {
      console.error(`❌ ValidationError JSON should include errors`);
      return false;
    }

    const clientJson = validationError.toClientJSON(false);
    if (!clientJson.errors || clientJson.errors.password.length !== 1) {
      console.error(`❌ ValidationError client JSON should include errors`);
      return false;
    }

    console.log("✅ ValidationError works correctly");
    return true;
  } catch (error) {
    console.error("❌ ValidationError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 5: AuthenticationError
 */
function testAuthenticationError(): boolean {
  console.log("\n📋 Test 5: AuthenticationError");
  console.log("─".repeat(50));

  try {
    const authError = new AuthenticationError("Invalid credentials");

    if (authError.statusCode !== HttpStatusCode.UNAUTHORIZED) {
      console.error(`❌ AuthenticationError status code should be 401`);
      return false;
    }

    if (authError.message !== "Invalid credentials") {
      console.error(`❌ AuthenticationError message mismatch`);
      return false;
    }

    // Test default message
    const defaultAuthError = new AuthenticationError();
    if (defaultAuthError.message !== "Authentication failed") {
      console.error(`❌ AuthenticationError default message mismatch`);
      return false;
    }

    console.log("✅ AuthenticationError works correctly");
    return true;
  } catch (error) {
    console.error("❌ AuthenticationError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 6: AuthorizationError
 */
function testAuthorizationError(): boolean {
  console.log("\n📋 Test 6: AuthorizationError");
  console.log("─".repeat(50));

  try {
    const authzError = new AuthorizationError("Access denied");

    if (authzError.statusCode !== HttpStatusCode.FORBIDDEN) {
      console.error(`❌ AuthorizationError status code should be 403`);
      return false;
    }

    if (authzError.message !== "Access denied") {
      console.error(`❌ AuthorizationError message mismatch`);
      return false;
    }

    // Test default message
    const defaultAuthzError = new AuthorizationError();
    if (!defaultAuthzError.message.includes("permission")) {
      console.error(`❌ AuthorizationError default message mismatch`);
      return false;
    }

    console.log("✅ AuthorizationError works correctly");
    return true;
  } catch (error) {
    console.error("❌ AuthorizationError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 7: TokenError
 */
function testTokenError(): boolean {
  console.log("\n📋 Test 7: TokenError");
  console.log("─".repeat(50));

  try {
    const tokenError = new TokenError("Token expired");

    if (tokenError.statusCode !== HttpStatusCode.UNAUTHORIZED) {
      console.error(`❌ TokenError status code should be 401`);
      return false;
    }

    if (tokenError.message !== "Token expired") {
      console.error(`❌ TokenError message mismatch`);
      return false;
    }

    // Test default message
    const defaultTokenError = new TokenError();
    if (!defaultTokenError.message.includes("token")) {
      console.error(`❌ TokenError default message mismatch`);
      return false;
    }

    console.log("✅ TokenError works correctly");
    return true;
  } catch (error) {
    console.error("❌ TokenError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 8: NotFoundError
 */
function testNotFoundError(): boolean {
  console.log("\n📋 Test 8: NotFoundError");
  console.log("─".repeat(50));

  try {
    // With identifier
    const notFoundError1 = new NotFoundError("User", "123");
    if (notFoundError1.statusCode !== HttpStatusCode.NOT_FOUND) {
      console.error(`❌ NotFoundError status code should be 404`);
      return false;
    }
    if (!notFoundError1.message.includes("User") || !notFoundError1.message.includes("123")) {
      console.error(`❌ NotFoundError message should include resource and identifier`);
      return false;
    }
    if (!notFoundError1.context || notFoundError1.context.resource !== "User") {
      console.error(`❌ NotFoundError context should include resource`);
      return false;
    }

    // Without identifier
    const notFoundError2 = new NotFoundError("Album");
    if (!notFoundError2.message.includes("Album")) {
      console.error(`❌ NotFoundError message should include resource`);
      return false;
    }

    console.log("✅ NotFoundError works correctly");
    return true;
  } catch (error) {
    console.error("❌ NotFoundError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 9: ConflictError
 */
function testConflictError(): boolean {
  console.log("\n📋 Test 9: ConflictError");
  console.log("─".repeat(50));

  try {
    const conflictError = new ConflictError("Email already exists");

    if (conflictError.statusCode !== HttpStatusCode.CONFLICT) {
      console.error(`❌ ConflictError status code should be 409`);
      return false;
    }

    if (conflictError.message !== "Email already exists") {
      console.error(`❌ ConflictError message mismatch`);
      return false;
    }

    // Test default message
    const defaultConflictError = new ConflictError();
    if (!defaultConflictError.message.includes("conflicts")) {
      console.error(`❌ ConflictError default message mismatch`);
      return false;
    }

    console.log("✅ ConflictError works correctly");
    return true;
  } catch (error) {
    console.error("❌ ConflictError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 10: isBaseError utility
 */
function testIsBaseError(): boolean {
  console.log("\n📋 Test 10: isBaseError Utility");
  console.log("─".repeat(50));

  try {
    const baseError = new BaseError("Test", HttpStatusCode.BAD_REQUEST);
    const validationError = new ValidationError({ field: ["error"] });
    const regularError = new Error("Regular error");
    const stringError = "String error";
    const nullError = null;

    if (!isBaseError(baseError)) {
      console.error(`❌ isBaseError should return true for BaseError`);
      return false;
    }

    if (!isBaseError(validationError)) {
      console.error(`❌ isBaseError should return true for ValidationError`);
      return false;
    }

    if (isBaseError(regularError)) {
      console.error(`❌ isBaseError should return false for regular Error`);
      return false;
    }

    if (isBaseError(stringError)) {
      console.error(`❌ isBaseError should return false for string`);
      return false;
    }

    if (isBaseError(nullError)) {
      console.error(`❌ isBaseError should return false for null`);
      return false;
    }

    console.log("✅ isBaseError utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ isBaseError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 11: isValidationError utility
 */
function testIsValidationError(): boolean {
  console.log("\n📋 Test 11: isValidationError Utility");
  console.log("─".repeat(50));

  try {
    const validationError = new ValidationError({ field: ["error"] });
    const baseError = new BaseError("Test", HttpStatusCode.BAD_REQUEST);
    const regularError = new Error("Regular error");

    if (!isValidationError(validationError)) {
      console.error(`❌ isValidationError should return true for ValidationError`);
      return false;
    }

    if (isValidationError(baseError)) {
      console.error(`❌ isValidationError should return false for BaseError`);
      return false;
    }

    if (isValidationError(regularError)) {
      console.error(`❌ isValidationError should return false for regular Error`);
      return false;
    }

    console.log("✅ isValidationError utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ isValidationError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 12: toBaseError utility
 */
function testToBaseError(): boolean {
  console.log("\n📋 Test 12: toBaseError Utility");
  console.log("─".repeat(50));

  try {
    // BaseError should be returned as-is
    const baseError = new BaseError("Test", HttpStatusCode.BAD_REQUEST);
    const converted1 = toBaseError(baseError);
    if (converted1 !== baseError) {
      console.error(`❌ toBaseError should return BaseError as-is`);
      return false;
    }

    // Regular Error should be wrapped
    const regularError = new Error("Regular error");
    const converted2 = toBaseError(regularError);
    if (!isBaseError(converted2)) {
      console.error(`❌ toBaseError should convert Error to BaseError`);
      return false;
    }
    if (converted2.statusCode !== HttpStatusCode.INTERNAL_SERVER_ERROR) {
      console.error(`❌ Converted error should have 500 status code`);
      return false;
    }
    if (converted2.isOperational) {
      console.error(`❌ Converted error should not be operational`);
      return false;
    }

    // String should be wrapped
    const stringError = "String error";
    const converted3 = toBaseError(stringError);
    if (!isBaseError(converted3)) {
      console.error(`❌ toBaseError should convert string to BaseError`);
      return false;
    }

    // ZodError should be handled
    // This will throw, so we catch it
    try {
      z.string().parse(123);
      console.error(`❌ ZodError should have been thrown`);
      return false;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const converted4 = toBaseError(error);
        if (!isBaseError(converted4)) {
          console.error(`❌ toBaseError should convert ZodError to BaseError`);
          return false;
        }
        if (converted4.statusCode !== HttpStatusCode.UNPROCESSABLE_ENTITY) {
          console.error(`❌ ZodError should convert to 422 status code`);
          return false;
        }
      } else {
        console.error(`❌ Expected ZodError but got: ${error}`);
        return false;
      }
    }

    console.log("✅ toBaseError utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ toBaseError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 13: getErrorStatusCode utility
 */
function testGetErrorStatusCode(): boolean {
  console.log("\n📋 Test 13: getErrorStatusCode Utility");
  console.log("─".repeat(50));

  try {
    const baseError = new BaseError("Test", HttpStatusCode.BAD_REQUEST);
    if (getErrorStatusCode(baseError) !== HttpStatusCode.BAD_REQUEST) {
      console.error(`❌ getErrorStatusCode should return error's status code`);
      return false;
    }

    const regularError = new Error("Regular error");
    if (getErrorStatusCode(regularError) !== HttpStatusCode.INTERNAL_SERVER_ERROR) {
      console.error(`❌ getErrorStatusCode should return 500 for unknown errors`);
      return false;
    }

    // Test ZodError
    try {
      z.string().parse(123);
    } catch (error) {
      if (error instanceof z.ZodError) {
        if (getErrorStatusCode(error) !== HttpStatusCode.UNPROCESSABLE_ENTITY) {
          console.error(`❌ getErrorStatusCode should return 422 for ZodError`);
          return false;
        }
      }
    }

    console.log("✅ getErrorStatusCode utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ getErrorStatusCode test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 14: serializeErrorForLogging utility
 */
function testSerializeErrorForLogging(): boolean {
  console.log("\n📋 Test 14: serializeErrorForLogging Utility");
  console.log("─".repeat(50));

  try {
    const baseError = new BaseError("Test", HttpStatusCode.BAD_REQUEST, true, { field: "value" });
    const serialized = serializeErrorForLogging(baseError);

    if (serialized.name !== "BaseError") {
      console.error(`❌ Serialized error name mismatch`);
      return false;
    }

    if (serialized.message !== "Test") {
      console.error(`❌ Serialized error message mismatch`);
      return false;
    }

    if (serialized.statusCode !== HttpStatusCode.BAD_REQUEST) {
      console.error(`❌ Serialized error status code mismatch`);
      return false;
    }

    if (!serialized.stack) {
      console.error(`❌ Serialized error should include stack trace`);
      return false;
    }

    if (!serialized.context || serialized.context.field !== "value") {
      console.error(`❌ Serialized error should include context`);
      return false;
    }

    console.log("✅ serializeErrorForLogging utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ serializeErrorForLogging test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 15: serializeErrorForClient utility
 */
function testSerializeErrorForClient(): boolean {
  console.log("\n📋 Test 15: serializeErrorForClient Utility");
  console.log("─".repeat(50));

  try {
    const baseError = new BaseError("Test", HttpStatusCode.BAD_REQUEST, true, { field: "value" });

    // Without details
    const serialized1 = serializeErrorForClient(baseError, false);
    if (serialized1.name !== "BaseError") {
      console.error(`❌ Client serialized error name mismatch`);
      return false;
    }
    if (serialized1.message !== "Test") {
      console.error(`❌ Client serialized error message mismatch`);
      return false;
    }
    if (serialized1.context) {
      console.error(`❌ Client serialized error should not include context when includeDetails=false`);
      return false;
    }

    // With details
    const serialized2 = serializeErrorForClient(baseError, true);
    if (!serialized2.context || serialized2.context.field !== "value") {
      console.error(`❌ Client serialized error should include context when includeDetails=true`);
      return false;
    }

    // Test with ValidationError
    const validationError = new ValidationError({ email: ["Invalid email"] });
    const serialized3 = serializeErrorForClient(validationError, false);
    if (!("errors" in serialized3) || !serialized3.errors) {
      console.error(`❌ ValidationError serialization should include errors`);
      return false;
    }

    console.log("✅ serializeErrorForClient utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ serializeErrorForClient test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 16: shouldLogError utility
 */
function testShouldLogError(): boolean {
  console.log("\n📋 Test 16: shouldLogError Utility");
  console.log("─".repeat(50));

  try {
    // Non-operational error should be logged
    const nonOperationalError = new BaseError("Test", HttpStatusCode.INTERNAL_SERVER_ERROR, false);
    if (!shouldLogError(nonOperationalError)) {
      console.error(`❌ Non-operational errors should be logged`);
      return false;
    }

    // Operational error should not be logged (expected errors)
    const operationalError = new BaseError("Test", HttpStatusCode.BAD_REQUEST, true);
    if (shouldLogError(operationalError)) {
      console.error(`❌ Operational errors should not be logged by default`);
      return false;
    }

    // Unknown error should be logged
    const unknownError = new Error("Unknown error");
    if (!shouldLogError(unknownError)) {
      console.error(`❌ Unknown errors should be logged`);
      return false;
    }

    console.log("✅ shouldLogError utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ shouldLogError test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 17: getClientErrorMessage utility
 */
function testGetClientErrorMessage(): boolean {
  console.log("\n📋 Test 17: getClientErrorMessage Utility");
  console.log("─".repeat(50));

  try {
    // BaseError
    const baseError = new BaseError("Test message", HttpStatusCode.BAD_REQUEST, true);
    const message1 = getClientErrorMessage(baseError, false);
    if (message1 !== "Test message") {
      console.error(`❌ getClientErrorMessage should return error message for BaseError`);
      return false;
    }

    // Non-operational error
    const nonOperationalError = new BaseError("Internal", HttpStatusCode.INTERNAL_SERVER_ERROR, false);
    const message2 = getClientErrorMessage(nonOperationalError, false);
    if (message2 !== "An unexpected error occurred") {
      console.error(`❌ getClientErrorMessage should return generic message for non-operational errors`);
      return false;
    }

    // Regular Error
    const regularError = new Error("Regular error");
    const message3 = getClientErrorMessage(regularError, false);
    if (message3 !== "An unexpected error occurred") {
      console.error(`❌ getClientErrorMessage should return generic message for regular errors`);
      return false;
    }

    // Unknown type
    const unknownError = "String error";
    const message4 = getClientErrorMessage(unknownError, false);
    if (message4 !== "An unexpected error occurred") {
      console.error(`❌ getClientErrorMessage should return generic message for unknown types`);
      return false;
    }

    console.log("✅ getClientErrorMessage utility works correctly");
    return true;
  } catch (error) {
    console.error("❌ getClientErrorMessage test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 18: Error inheritance and polymorphism
 */
function testErrorInheritance(): boolean {
  console.log("\n📋 Test 18: Error Inheritance and Polymorphism");
  console.log("─".repeat(50));

  try {
    // All error types should be instances of BaseError
    const validationError = new ValidationError({ field: ["error"] });
    const authError = new AuthenticationError();
    const notFoundError = new NotFoundError("Resource");

    if (!(validationError instanceof BaseError)) {
      console.error(`❌ ValidationError should be instance of BaseError`);
      return false;
    }

    if (!(authError instanceof BaseError)) {
      console.error(`❌ AuthenticationError should be instance of BaseError`);
      return false;
    }

    if (!(notFoundError instanceof BaseError)) {
      console.error(`❌ NotFoundError should be instance of BaseError`);
      return false;
    }

    // All should work with BaseError utilities
    const errors = [validationError, authError, notFoundError];
    for (const error of errors) {
      if (!isBaseError(error)) {
        console.error(`❌ All error types should work with isBaseError`);
        return false;
      }

      const statusCode = getErrorStatusCode(error);
      if (statusCode < 400 || statusCode >= 600) {
        console.error(`❌ All error types should have valid HTTP status codes`);
        return false;
      }

      const serialized = serializeErrorForClient(error, false);
      if (!serialized.name || !serialized.message || !serialized.statusCode) {
        console.error(`❌ All error types should serialize correctly`);
        return false;
      }
    }

    console.log("✅ Error inheritance and polymorphism works correctly");
    return true;
  } catch (error) {
    console.error("❌ Error inheritance test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 19: Error context handling
 */
function testErrorContext(): boolean {
  console.log("\n📋 Test 19: Error Context Handling");
  console.log("─".repeat(50));

  try {
    const context = {
      userId: "123",
      action: "create",
      resource: "album",
    };

    const error = new BaseError("Test", HttpStatusCode.BAD_REQUEST, true, context);

    // Context should be included in JSON
    const json = error.toJSON(false, true);
    if (!json.context || json.context.userId !== "123") {
      console.error(`❌ Error context should be included in JSON`);
      return false;
    }

    // Context should be included in client JSON when includeDetails=true
    const clientJson = error.toClientJSON(true);
    if (!clientJson.context || clientJson.context.action !== "create") {
      console.error(`❌ Error context should be included in client JSON when includeDetails=true`);
      return false;
    }

    // Context should not be included in client JSON when includeDetails=false
    const clientJsonNoDetails = error.toClientJSON(false);
    if (clientJsonNoDetails.context) {
      console.error(`❌ Error context should not be included in client JSON when includeDetails=false`);
      return false;
    }

    console.log("✅ Error context handling works correctly");
    return true;
  } catch (error) {
    console.error("❌ Error context test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 20: HTTP status code enum
 */
function testHttpStatusCodeEnum(): boolean {
  console.log("\n📋 Test 20: HTTP Status Code Enum");
  console.log("─".repeat(50));

  try {
    // Test that all expected status codes exist
    const expectedCodes = [
      HttpStatusCode.BAD_REQUEST,
      HttpStatusCode.UNAUTHORIZED,
      HttpStatusCode.FORBIDDEN,
      HttpStatusCode.NOT_FOUND,
      HttpStatusCode.CONFLICT,
      HttpStatusCode.UNPROCESSABLE_ENTITY,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
    ];

    for (const code of expectedCodes) {
      if (typeof code !== "number" || code < 400 || code >= 600) {
        console.error(`❌ Invalid HTTP status code: ${code}`);
        return false;
      }
    }

    // Test that status codes match expected values
    if (HttpStatusCode.BAD_REQUEST !== 400) {
      console.error(`❌ BAD_REQUEST should be 400`);
      return false;
    }

    if (HttpStatusCode.UNAUTHORIZED !== 401) {
      console.error(`❌ UNAUTHORIZED should be 401`);
      return false;
    }

    if (HttpStatusCode.FORBIDDEN !== 403) {
      console.error(`❌ FORBIDDEN should be 403`);
      return false;
    }

    if (HttpStatusCode.NOT_FOUND !== 404) {
      console.error(`❌ NOT_FOUND should be 404`);
      return false;
    }

    if (HttpStatusCode.CONFLICT !== 409) {
      console.error(`❌ CONFLICT should be 409`);
      return false;
    }

    if (HttpStatusCode.UNPROCESSABLE_ENTITY !== 422) {
      console.error(`❌ UNPROCESSABLE_ENTITY should be 422`);
      return false;
    }

    if (HttpStatusCode.INTERNAL_SERVER_ERROR !== 500) {
      console.error(`❌ INTERNAL_SERVER_ERROR should be 500`);
      return false;
    }

    console.log("✅ HTTP status code enum works correctly");
    return true;
  } catch (error) {
    console.error("❌ HTTP status code enum test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Error Handling Framework Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({ name: "Test 1: BaseError Basic Functionality", passed: testBaseErrorBasic() });
  results.push({ name: "Test 2: BaseError Serialization", passed: testBaseErrorSerialization() });
  results.push({ name: "Test 3: BaseError Client Message", passed: testBaseErrorClientMessage() });
  results.push({ name: "Test 4: ValidationError", passed: testValidationError() });
  results.push({ name: "Test 5: AuthenticationError", passed: testAuthenticationError() });
  results.push({ name: "Test 6: AuthorizationError", passed: testAuthorizationError() });
  results.push({ name: "Test 7: TokenError", passed: testTokenError() });
  results.push({ name: "Test 8: NotFoundError", passed: testNotFoundError() });
  results.push({ name: "Test 9: ConflictError", passed: testConflictError() });
  results.push({ name: "Test 10: isBaseError Utility", passed: testIsBaseError() });
  results.push({ name: "Test 11: isValidationError Utility", passed: testIsValidationError() });
  results.push({ name: "Test 12: toBaseError Utility", passed: testToBaseError() });
  results.push({ name: "Test 13: getErrorStatusCode Utility", passed: testGetErrorStatusCode() });
  results.push({ name: "Test 14: serializeErrorForLogging Utility", passed: testSerializeErrorForLogging() });
  results.push({ name: "Test 15: serializeErrorForClient Utility", passed: testSerializeErrorForClient() });
  results.push({ name: "Test 16: shouldLogError Utility", passed: testShouldLogError() });
  results.push({ name: "Test 17: getClientErrorMessage Utility", passed: testGetClientErrorMessage() });
  results.push({ name: "Test 18: Error Inheritance and Polymorphism", passed: testErrorInheritance() });
  results.push({ name: "Test 19: Error Context Handling", passed: testErrorContext() });
  results.push({ name: "Test 20: HTTP Status Code Enum", passed: testHttpStatusCodeEnum() });

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

