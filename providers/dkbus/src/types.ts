export type APIVehicle = {
	jour: string;
	ligne: string | number;
	couleur: string | 0;
	destination: string | 0;
	course: number;
	numero: number;
	lng: string | number;
	lat: string | number;
};

export type APIResponse = {
	liste?: {
		vehicule?: APIVehicle[] | APIVehicle;
	};
};

export type SiriEstimatedCall = {
	StopPointRef: string;
	Order: number;
	StopPointName: string;
	VehicleAtStop: boolean;
	AimedArrivalTime: string;
	ExpectedArrivalTime: string;
	ArrivalStatus?: "arrived";
};

export type SiriVehicleJourney = {
	LineRef: string;
	DatedVehicleJourneyRef: number;
	EstimatedCalls: {
		EstimatedCall: SiriEstimatedCall | SiriEstimatedCall[];
	};
};

export type SiriResponse = {
	Envelope: {
		Body: {
			GetEstimatedTimetableResponse: {
				Answer: {
					EstimatedTimetableDelivery: {
						EstimatedJourneyVersionFrame: {
							RecordedAtTime: string;
							EstimatedVehicleJourney: SiriVehicleJourney | SiriVehicleJourney[];
						}[];
					};
				};
			};
		};
	};
};
