export type APIVehicle = {
	jour: string;
	ligne: string | number;
	couleur: string | 0;
	destination: string | 0;
	numero: number;
	lng: string | number;
	lat: string | number;
};

export type APIResponse = {
	liste?: {
		vehicule?: APIVehicle[] | APIVehicle;
	};
};
