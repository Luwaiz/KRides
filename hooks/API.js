import Production from "./Production";
import {API_URL} from "@env"

const url = Production ? API_URL : "";

export default {
    "Register":`${url}/auth/register-step-one`,
    "Login":`${url}/auth/login`,
    "UserProfile":`${url}/auth/user-profile`
};
