/**
 * Example Server Action
 * 
 * Demonstrates how to use error handling in Server Actions.
 * Note: Server Actions don't use the route handler utilities,
 * but you can still use the error classes and logging.
 */

"use server";

import { BaseError, ValidationError } from "@/lib/errors";
import { getLogger } from "@/lib/logging";

const logger = getLogger();

/**
 * Example Server Action with error handling
 */
export async function exampleAction(input: { name: string; email: string }) {
  try {
    // Validate input
    if (!input.name || !input.email) {
      throw new ValidationError("Name and email are required", {
        fields: {
          name: input.name ? undefined : "Name is required",
          email: input.email ? undefined : "Email is required",
        },
      });
    }

    // Your business logic
    logger.info({ name: input.name, email: input.email }, "Processing action");

    return {
      success: true,
      message: `Hello, ${input.name}!`,
    };
  } catch (error) {
    // Log error
    logger.error(error, { action: "exampleAction" });

    // Re-throw to let Next.js handle it
    // Next.js will automatically serialize errors for the client
    throw error;
  }
}

/**
 * Example Server Action that returns error instead of throwing
 * 
 * Sometimes you may want to return an error object instead of throwing.
 */
export async function exampleActionWithErrorReturn(
  input: { value: number }
): Promise<{ success: true; result: number } | { success: false; error: string }> {
  try {
    if (input.value < 0) {
      throw new ValidationError("Value must be positive");
    }

    return {
      success: true,
      result: input.value * 2,
    };
  } catch (error) {
    logger.error(error, { action: "exampleActionWithErrorReturn" });

    // Return error instead of throwing
    if (error instanceof BaseError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}

