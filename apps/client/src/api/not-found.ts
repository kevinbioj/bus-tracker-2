import { notFound } from "@tanstack/react-router";
import { isHTTPError } from "ky";

export const notFoundOnHttp404 = (error: unknown) => {
	if (isHTTPError(error) && error.response.status === 404) throw notFound();
};
