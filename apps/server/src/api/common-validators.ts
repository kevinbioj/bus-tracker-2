import { z } from "zod";

import { createParamValidator } from "./validator-helpers.js";

export const byIdParamValidator = createParamValidator(
	z.object({
		id: z.coerce
			.number({ error: "Param 'id' must be a valid number." })
			.int({ error: "Param 'id' must be a valid integer." }),
	}),
);
